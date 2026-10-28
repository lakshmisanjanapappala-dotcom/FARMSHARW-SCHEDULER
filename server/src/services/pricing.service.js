import { env } from '../config/env.js';
import { AppError } from '../middleware/error-handler.js';

export class PricingService {
  /**
   * Calculate rental duration in hours, days, weeks
   */
  static calculateDuration(startTimeStr, endTimeStr) {
    const start = new Date(startTimeStr);
    const end = new Date(endTimeStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('Invalid date format for booking range', 400, 'INVALID_DATE');
    }

    if (end <= start) {
      throw new AppError('End time must be strictly later than start time', 400, 'INVALID_TIME_RANGE');
    }

    const durationMs = end.getTime() - start.getTime();
    const durationHours = parseFloat((durationMs / (1000 * 60 * 60)).toFixed(2));
    const durationDays = parseFloat((durationHours / 24).toFixed(2));
    const durationWeeks = parseFloat((durationDays / 7).toFixed(2));

    return {
      start,
      end,
      durationHours,
      durationDays,
      durationWeeks
    };
  }

  /**
   * Calculate authoritative quote with itemized breakdown
   */
  static calculateQuote({
    equipment,
    pricingRule,
    startTime,
    endTime,
    handoverMethod = 'pickup',
    deliveryDistanceKm = 0,
    promoDiscountAmount = 0
  }) {
    const { durationHours, durationDays, durationWeeks } = this.calculateDuration(startTime, endTime);

    if (durationHours < equipment.min_rental_hours) {
      throw new AppError(
        `Minimum rental period for this equipment is ${equipment.min_rental_hours} hours. (Requested: ${durationHours} hours)`,
        400,
        'MINIMUM_DURATION_NOT_MET'
      );
    }

    if (durationDays > equipment.max_rental_days) {
      throw new AppError(
        `Maximum rental period for this equipment is ${equipment.max_rental_days} days. (Requested: ${durationDays} days)`,
        400,
        'MAXIMUM_DURATION_EXCEEDED'
      );
    }

    const lineItems = [];
    let baseRentalAmount = 0;

    // Pricing Rule Determination:
    // If seasonal rate exists and duration >= 30 days
    if (pricingRule.seasonal_rate && durationDays >= 30) {
      const months = Math.ceil(durationDays / 30);
      baseRentalAmount = pricingRule.seasonal_rate * months;
      lineItems.push({
        item_type: 'base_rent',
        description: `Seasonal / monthly rental rate (₹${pricingRule.seasonal_rate} x ${months} season period)`,
        rate: pricingRule.seasonal_rate,
        quantity: months,
        amount: baseRentalAmount
      });
    }
    // Else if weekly rate exists and duration >= 7 days
    else if (pricingRule.weekly_rate && durationDays >= 7) {
      const weeks = Math.floor(durationDays / 7);
      const remainingDays = Math.ceil(durationDays % 7);
      const weeklyTotal = weeks * pricingRule.weekly_rate;
      const dailyRemainderTotal = remainingDays * (pricingRule.daily_rate || (pricingRule.weekly_rate / 7));
      baseRentalAmount = weeklyTotal + dailyRemainderTotal;

      lineItems.push({
        item_type: 'base_rent',
        description: `Weekly rental rate (₹${pricingRule.weekly_rate} x ${weeks} week${weeks > 1 ? 's' : ''})`,
        rate: pricingRule.weekly_rate,
        quantity: weeks,
        amount: weeklyTotal
      });

      if (remainingDays > 0) {
        lineItems.push({
          item_type: 'base_rent',
          description: `Additional days (₹${pricingRule.daily_rate} x ${remainingDays} day${remainingDays > 1 ? 's' : ''})`,
          rate: pricingRule.daily_rate,
          quantity: remainingDays,
          amount: dailyRemainderTotal
        });
      }
    }
    // Else if daily rate exists and duration >= 24 hours
    else if (pricingRule.daily_rate && durationHours >= 24) {
      const days = Math.ceil(durationHours / 24);
      baseRentalAmount = days * pricingRule.daily_rate;
      lineItems.push({
        item_type: 'base_rent',
        description: `Daily rental rate (₹${pricingRule.daily_rate} x ${days} day${days > 1 ? 's' : ''})`,
        rate: pricingRule.daily_rate,
        quantity: days,
        amount: baseRentalAmount
      });
    }
    // Else hourly rate
    else if (pricingRule.hourly_rate) {
      baseRentalAmount = durationHours * pricingRule.hourly_rate;
      lineItems.push({
        item_type: 'base_rent',
        description: `Hourly rental rate (₹${pricingRule.hourly_rate}/hr x ${durationHours} hrs)`,
        rate: pricingRule.hourly_rate,
        quantity: durationHours,
        amount: baseRentalAmount
      });
    } else {
      // Fallback to daily rate
      baseRentalAmount = Math.max(1, Math.ceil(durationHours / 24)) * pricingRule.daily_rate;
      lineItems.push({
        item_type: 'base_rent',
        description: `Standard daily rate (₹${pricingRule.daily_rate})`,
        rate: pricingRule.daily_rate,
        quantity: 1,
        amount: baseRentalAmount
      });
    }

    // Apply minimum charge if applicable
    if (pricingRule.minimum_charge && baseRentalAmount < pricingRule.minimum_charge) {
      const diff = pricingRule.minimum_charge - baseRentalAmount;
      baseRentalAmount = pricingRule.minimum_charge;
      lineItems.push({
        item_type: 'minimum_charge_adjustment',
        description: `Equipment minimum charge baseline (₹${pricingRule.minimum_charge})`,
        rate: diff,
        quantity: 1,
        amount: diff
      });
    }

    // Delivery charge
    let deliveryFee = 0;
    if (handoverMethod === 'owner_delivery') {
      if (!equipment.delivery_offered) {
        throw new AppError('Delivery is not offered by the owner for this equipment', 400, 'DELIVERY_NOT_OFFERED');
      }
      if (deliveryDistanceKm > equipment.max_delivery_radius_km) {
        throw new AppError(
          `Delivery distance (${deliveryDistanceKm} km) exceeds maximum delivery radius of ${equipment.max_delivery_radius_km} km`,
          400,
          'DELIVERY_RADIUS_EXCEEDED'
        );
      }
      deliveryFee = Math.round((deliveryDistanceKm * (equipment.delivery_fee_per_km || 0)) * 100) / 100;
      if (deliveryFee > 0) {
        lineItems.push({
          item_type: 'delivery',
          description: `Handover delivery (${deliveryDistanceKm} km @ ₹${equipment.delivery_fee_per_km}/km)`,
          rate: equipment.delivery_fee_per_km,
          quantity: deliveryDistanceKm,
          amount: deliveryFee
        });
      }
    }

    // Refundable Security Deposit
    let depositAmount = 0;
    if (equipment.deposit_required && equipment.deposit_amount > 0) {
      depositAmount = parseFloat(equipment.deposit_amount);
      lineItems.push({
        item_type: 'deposit',
        description: 'Refundable security deposit (returned upon satisfactory equipment return)',
        rate: depositAmount,
        quantity: 1,
        amount: depositAmount
      });
    }

    // Promotional Discount
    const validDiscount = Math.min(promoDiscountAmount, baseRentalAmount);
    if (validDiscount > 0) {
      lineItems.push({
        item_type: 'discount',
        description: 'Promotional rental discount',
        rate: -validDiscount,
        quantity: 1,
        amount: -validDiscount
      });
    }

    const netRentalAmount = Math.max(0, baseRentalAmount - validDiscount);

    // Platform Fee (5%)
    const platformFeePercentage = env.PLATFORM_FEE_PERCENTAGE || 5.0;
    const platformFee = Math.round((netRentalAmount * (platformFeePercentage / 100)) * 100) / 100;
    lineItems.push({
      item_type: 'platform_fee',
      description: `Platform technology fee (${platformFeePercentage}%)`,
      rate: platformFee,
      quantity: 1,
      amount: platformFee
    });

    // GST Tax (18% on services: platform fee + delivery)
    const gstPercentage = env.GST_PERCENTAGE || 18.0;
    const taxableServicesAmount = platformFee + deliveryFee;
    const taxAmount = Math.round((taxableServicesAmount * (gstPercentage / 100)) * 100) / 100;
    lineItems.push({
      item_type: 'gst_tax',
      description: `Goods and Services Tax (${gstPercentage}% on platform & delivery services)`,
      rate: taxAmount,
      quantity: 1,
      amount: taxAmount
    });

    // Authoritative Total: Net Base Rent + Delivery Fee + Deposit + Platform Fee + Tax
    const totalAmount = Math.round((netRentalAmount + deliveryFee + depositAmount + platformFee + taxAmount) * 100) / 100;

    return {
      durationHours,
      durationDays,
      currency: 'INR',
      baseRentalAmount: Math.round(baseRentalAmount * 100) / 100,
      deliveryFee,
      depositAmount,
      discountAmount: validDiscount,
      platformFee,
      taxAmount,
      totalAmount,
      lineItems
    };
  }
}

