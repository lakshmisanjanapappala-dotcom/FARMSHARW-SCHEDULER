import { memoryDb } from '../config/supabase.js';
import { AppError } from '../middleware/error-handler.js';

export class EquipmentService {
  /**
   * Haversine distance in KM
   */
  static haversineDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  /**
   * Search equipment listings with filters and pagination
   */
  static searchEquipment({
    keyword,
    category,
    state,
    district,
    pinCode,
    condition,
    deliveryOffered,
    isExchangeEligible,
    lat,
    lng,
    radiusKm,
    sortBy = 'newest',
    page = 1,
    limit = 12,
    includeUnpublished = false,
    ownerId = null
  }) {
    let results = memoryDb.tables.equipment.filter(e => {
      if (!includeUnpublished && !e.is_published && e.owner_id !== ownerId) return false;
      if (ownerId && e.owner_id !== ownerId) return false;

      if (category) {
        const cat = memoryDb.tables.equipment_categories.find(c => c.slug === category || c.id === category);
        if (cat && e.category_id !== cat.id) return false;
      }

      if (state && e.state.toLowerCase() !== state.toLowerCase()) return false;
      if (district && e.district.toLowerCase() !== district.toLowerCase()) return false;
      if (pinCode && !e.pin_code.includes(pinCode)) return false;
      if (condition && e.condition !== condition) return false;
      if (deliveryOffered !== undefined && e.delivery_offered !== deliveryOffered) return false;
      if (isExchangeEligible !== undefined && e.is_exchange_eligible !== isExchangeEligible) return false;

      if (keyword) {
        const kw = keyword.toLowerCase();
        const matches =
          e.title.toLowerCase().includes(kw) ||
          e.description.toLowerCase().includes(kw) ||
          (e.manufacturer && e.manufacturer.toLowerCase().includes(kw)) ||
          (e.model && e.model.toLowerCase().includes(kw)) ||
          e.village_or_town.toLowerCase().includes(kw);
        if (!matches) return false;
      }

      return true;
    });

    // Attach pricing and images & calculate distance
    const parsedLat = lat ? parseFloat(lat) : null;
    const parsedLng = lng ? parseFloat(lng) : null;
    const maxRadius = radiusKm ? parseFloat(radiusKm) : null;

    results = results.map(item => {
      const pricing = memoryDb.tables.equipment_pricing_rules.find(pr => pr.equipment_id === item.id && pr.is_active);
      const images = memoryDb.tables.equipment_images.filter(img => img.equipment_id === item.id);
      const categoryObj = memoryDb.tables.equipment_categories.find(c => c.id === item.category_id);
      const owner = memoryDb.tables.profiles.find(p => p.id === item.owner_id);

      let distanceKm = null;
      if (parsedLat && parsedLng && item.approximate_lat && item.approximate_lng) {
        distanceKm = this.haversineDistance(parsedLat, parsedLng, item.approximate_lat, item.approximate_lng);
      }

      return {
        ...item,
        category: categoryObj,
        pricing: pricing || null,
        images: images.length > 0 ? images : [{ image_url: '/assets/images/tractor.svg', caption: item.title }],
        owner_name: owner ? owner.full_name : 'Equipment Owner',
        distanceKm,
        // Privacy: strip exact_address if requester is not owner
        exact_address: (ownerId && item.owner_id === ownerId) ? item.exact_address : undefined
      };
    });

    // Radius filter if specified
    if (parsedLat && parsedLng && maxRadius) {
      results = results.filter(item => item.distanceKm !== null && item.distanceKm <= maxRadius);
    }

    // Sorting
    if (sortBy === 'distance' && parsedLat && parsedLng) {
      results.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
    } else if (sortBy === 'price_asc') {
      results.sort((a, b) => (a.pricing?.daily_rate ?? 99999) - (b.pricing?.daily_rate ?? 99999));
    } else if (sortBy === 'price_desc') {
      results.sort((a, b) => (b.pricing?.daily_rate ?? 0) - (a.pricing?.daily_rate ?? 0));
    } else {
      // Default: newest
      results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    const total = results.length;
    const offset = (page - 1) * limit;
    const paginated = results.slice(offset, offset + limit);

    return {
      items: paginated,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get equipment by ID or slug
   */
  static getEquipmentById(idOrSlug, requesterId = null) {
    const item = memoryDb.tables.equipment.find(e => e.id === idOrSlug || e.slug === idOrSlug);
    if (!item) {
      throw new AppError('Equipment listing not found', 404, 'EQUIPMENT_NOT_FOUND');
    }

    const pricing = memoryDb.tables.equipment_pricing_rules.find(pr => pr.equipment_id === item.id && pr.is_active);
    const images = memoryDb.tables.equipment_images.filter(img => img.equipment_id === item.id);
    const category = memoryDb.tables.equipment_categories.find(c => c.id === item.category_id);
    const owner = memoryDb.tables.profiles.find(p => p.id === item.owner_id);
    const blackoutPeriods = memoryDb.tables.equipment_blackout_periods.filter(bp => bp.equipment_id === item.id);

    // Fetch review aggregates
    const reviews = memoryDb.tables.reviews.filter(r => r.equipment_id === item.id && r.is_visible);
    const avgRating = reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : null;

    // Check if requester has a confirmed booking for exact address visibility
    const hasConfirmedBooking = requesterId
      ? memoryDb.tables.bookings.some(
          b => b.equipment_id === item.id && b.renter_id === requesterId && ['confirmed', 'active', 'completed'].includes(b.status)
        )
      : false;

    return {
      ...item,
      category,
      pricing: pricing || null,
      images: images.length > 0 ? images : [{ image_url: '/assets/images/tractor.svg', caption: item.title }],
      owner: owner ? { id: owner.id, full_name: owner.full_name, phone_verified: owner.phone_verified, state: owner.state, district: owner.district } : null,
      blackoutPeriods,
      rating: avgRating ? parseFloat(avgRating) : null,
      reviewCount: reviews.length,
      // Hide exact address unless owner or confirmed renter
      exact_address: (requesterId === item.owner_id || hasConfirmedBooking) ? item.exact_address : undefined
    };
  }
}

