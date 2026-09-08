import { get, post, patch, put, del, download } from './client'

// ── Auth ─────────────────────────────────────────────────────
export const authApi = {
  login: (username, password) => post('/auth/login/', { username, password }),
  me: () => get('/auth/me/'),
}

// ── Users ────────────────────────────────────────────────────
export const usersApi = {
  list: () => get('/users/'),
  create: (data) => post('/users/', data),
  update: (id, data) => patch(`/users/${id}/`, data),
  delete: (id) => del(`/users/${id}/`),
  setPanelPassword: (id, panel_password) => post(`/users/${id}/set_panel_password/`, { panel_password }),
}

// ── Panel Password ───────────────────────────────────────────
export const panelPasswordApi = {
  verify: (panel_password) => post('/auth/verify-panel-password/', { panel_password }),
  setOwn: (panel_password) => post('/auth/set-panel-password/', { panel_password }),
}

// ── Brands ───────────────────────────────────────────────────
export const brandsApi = {
  list: (params) => get('/brands/', params),
  create: (name) => post('/brands/', { name }),
  update: (id, name) => put(`/brands/${id}/`, { name }),
  toggleStatus: (id, status) => patch(`/brands/${id}/`, { status }),
  delete: (id) => del(`/brands/${id}/`),
}

// ── Categories ────────────────────────────────────────────────
export const categoriesApi = {
  list: (params) => get('/categories/', params),
  create: (name, brand) => post('/categories/', { name, brand }),
  update: (id, data) => patch(`/categories/${id}/`, data),
  toggleStatus: (id, status) => patch(`/categories/${id}/`, { status }),
  delete: (id) => del(`/categories/${id}/`),
}

// ── Products ─────────────────────────────────────────────────
export const productsApi = {
  list: (params) => get('/products/', params),
  create: (data) => post('/products/', data),
  update: (id, data) => patch(`/products/${id}/`, data),
  toggleStatus: (id, status) => patch(`/products/${id}/`, { status }),
  delete: (id) => del(`/products/${id}/`),
}

// ── Sizes ────────────────────────────────────────────────────
export const sizesApi = {
  list: (params) => get('/sizes/', params),
  create: (name, product) => post('/sizes/', { name, product }),
  delete: (id) => del(`/sizes/${id}/`),
}

export const unitsApi = {
  list: (params) => get('/sizes/', params),
  create: (name) => post('/sizes/', { name }),
  update: (id, name) => put(`/sizes/${id}/`, { name }),
  toggleStatus: (id, status) => patch(`/sizes/${id}/`, { status }),
  delete: (id) => del(`/sizes/${id}/`),
}

// ── Packing ──────────────────────────────────────────────────
export const packingApi = {
  list: (params) => get('/packing/', params),
  create: (name) => post('/packing/', { name }),
  update: (id, name) => put(`/packing/${id}/`, { name }),
  toggleStatus: (id, status) => patch(`/packing/${id}/`, { status }),
  delete: (id) => del(`/packing/${id}/`),
}

export const packagingApi = packingApi

// ── Suppliers ────────────────────────────────────────────────
export const suppliersApi = {
  list: () => get('/suppliers/'),
  create: (data) => post('/suppliers/', data),
  update: (id, data) => patch(`/suppliers/${id}/`, data),
  delete: (id) => del(`/suppliers/${id}/`),
}

// ── Customers ────────────────────────────────────────────────
export const customersApi = {
  list: () => get('/customers/'),
  create: (data) => post('/customers/', data),
  update: (id, data) => patch(`/customers/${id}/`, data),
  delete: (id) => del(`/customers/${id}/`),
}

// ── Gate Inward ──────────────────────────────────────────────
export const gateInwardApi = {
  list: (params) => get('/gate-inward/', params),
  get: (id) => get(`/gate-inward/${id}/`),
  create: (data) => post('/gate-inward/', data),
  update: (id, data) => patch(`/gate-inward/${id}/`, data),
  delete: (id) => del(`/gate-inward/${id}/`),
  nextGR: () => get('/gate-inward/next-gr/'),
  report: (params, filename) => download('/gate-inward/report/', params, filename),
}

// ── Gate Outward ─────────────────────────────────────────────
export const gateOutwardApi = {
  list: (params) => get('/gate-outward/', params),
  create: (data) => post('/gate-outward/', data),
  update: (id, data) => patch(`/gate-outward/${id}/`, data),
  delete: (id) => del(`/gate-outward/${id}/`),
  nextGO: () => get('/gate-outward/next-go/'),
  report: (params, filename) => download('/gate-outward/report/', params, filename),
}

// ── Inventory ────────────────────────────────────────────────
export const inventoryApi = {
  list: (params) => get('/inventory/', params),
  updateComment: (id, comment) => patch(`/inventory/${id}/`, { comment }),
  delete: (id) => del(`/inventory/${id}/`),
  history: (params) => get('/inventory/history/', params),
  report: (params, filename) => download('/inventory/report/', params, filename),
}

export const cbmProductsApi = {
  list: () => get('/cbm-products/'),
  create: (data) => post('/cbm-products/', data),
  update: (id, data) => patch(`/cbm-products/${id}/`, data),
  delete: (id) => del(`/cbm-products/${id}/`),
}

// ── Requisition ──────────────────────────────────────────────
export const requisitionApi = {
  list: (params) => get('/requisitions/', params),
  create: (data) => post('/requisitions/', data),
  delete: (id) => del(`/requisitions/${id}/`),
  returnGoods: (data) => post('/requisitions/return/', data),
  report: (params, filename) => download('/requisitions/report/', params, filename),
}

// ── Daily Production ─────────────────────────────────────────
export const dailyProductionApi = {
  list: (params) => get('/daily-production/', params),
  create: (data) => post('/daily-production/', data),
  update: (id, data) => patch(`/daily-production/${id}/`, data),
  delete: (id) => del(`/daily-production/${id}/`),
  report: (params, filename) => download('/daily-production/report/', params, filename),
}

// ── Production Order ─────────────────────────────────────────
export const productionOrderApi = {
  list: (params) => get('/production-orders/', params),
  create: (data) => post('/production-orders/', data),
  update: (id, data) => patch(`/production-orders/${id}/`, data),
  updateItemStatus: (orderId, itemId, status) =>
    patch(`/production-orders/${orderId}/items/${itemId}/`, { status }),
  delete: (id) => del(`/production-orders/${id}/`),
  report: (params, filename) => download('/production-orders/report/', params, filename),
}

// ── Finished Goods ───────────────────────────────────────────
export const finishedGoodsApi = {
  list: (params) => get('/finished-goods/', { transactions_only: true, ...(params || {}) }),
  create: (data) => post('/finished-goods/', data),
  update: (id, data) => patch(`/finished-goods/${id}/`, data),
  delete: (id) => del(`/finished-goods/${id}/`),
}

// Finished Good Products (master data used by product selectors)
export const finishedGoodProductsApi = {
  list: (params) => get('/finished-good-products/', params),
  create: (data) => post('/finished-good-products/', data),
  update: (id, data) => patch(`/finished-good-products/${id}/`, data),
  delete: (id) => del(`/finished-good-products/${id}/`),
}

// ── Recipes ──────────────────────────────────────────────────
export const recipesApi = {
  list: () => get('/recipes/'),
  get: (id) => get(`/recipes/${id}/`),
  create: (data) => post('/recipes/', data),
  update: (id, data) => patch(`/recipes/${id}/`, data),
  delete: (id) => del(`/recipes/${id}/`),
  scale: (id, qty) => post(`/recipes/${id}/scale/`, { desired_quantity: qty }),
}

// ── Dashboard ─────────────────────────────────────────────────
export const dashboardApi = {
  today: () => get('/dashboard/today/'),
}

// —— Accounting State (Backend persistence for Accounts panel) ———————————————————————
export const accountingStateApi = {
  getState: () => get('/accounting/state/'),
  updateSegments: (segments) => patch('/accounting/state/', { segments }),
  resetState: () => post('/accounting/state/reset/', {}),
}
