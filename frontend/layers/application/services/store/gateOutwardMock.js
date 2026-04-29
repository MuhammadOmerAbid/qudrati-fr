export const GATE_OUTWARD_STORAGE_KEY = 'qf-gate-outward-records'

export const SOURCES = [
  'Main Warehouse',
  'Production Floor',
  'Return Stock',
]

export const UNITS = ['Unit', 'Cartons', 'Bags', 'KG']

export const PRODUCTS = [
  { id: 1, name: '69 mm seal', brand: 'General', unit: 'Unit', available: 3200 },
  { id: 2, name: '72 MM Seal', brand: 'Handi', unit: 'Cartons', available: 160 },
  { id: 3, name: '72 MM Seal', brand: 'Raja', unit: 'Cartons', available: 140 },
  { id: 4, name: '500ml Bottle', brand: 'General', unit: 'Unit', available: 6200 },
  { id: 5, name: '1L Bottle', brand: 'General', unit: 'Unit', available: 4100 },
]

export const CUSTOMERS = [
  { id: 1, name: 'Hudaibiya', address: 'Ut illum totam fugi' },
  { id: 2, name: 'Bilal', address: 'Mollitia dolor incid' },
  { id: 3, name: 'Nuovo Foods', address: 'Non ea sit dolor ip' },
  { id: 4, name: 'Super Asia', address: 'Ullamco nihil necess' },
]

export const INITIAL_GATE_OUTWARD_RECORDS = [
  {
    id: 1,
    goNo: 'QUD1',
    date: '13/08/2022',
    vehicleNo: 'Vitae aut quibusdam',
    driverName: 'Aliqua Eum in tenet',
    driverPhone: '03001234567',
    driverCnic: '35202-1234567-1',
    customerName: 'Super Asia',
    address: 'Ullamco nihil necess',
    note: '',
    numbering: 'Line 1',
    batchNumber: 'B-2022-08-13-01',
    items: [
      { source: 'Main Warehouse', productId: 3, productName: '72 MM Seal', brand: 'Raja', quantity: 1, unit: 'Cartons' },
    ],
  },
  {
    id: 2,
    goNo: 'QUD2',
    date: '22/10/2011',
    vehicleNo: 'Pariatur Explicabo',
    driverName: 'Magni quisquam rem n',
    driverPhone: '03221234567',
    driverCnic: '35202-7654321-0',
    customerName: 'Nuovo Foods',
    address: 'Non ea sit dolor ip',
    note: '',
    numbering: 'Line 2',
    batchNumber: 'B-2011-10-22-02',
    items: [
      { source: 'Production Floor', productId: 2, productName: '72 MM Seal', brand: 'Handi', quantity: 1, unit: 'Cartons' },
      { source: 'Production Floor', productId: 3, productName: '72 MM Seal', brand: 'Raja', quantity: 2, unit: 'Cartons' },
    ],
  },
  {
    id: 3,
    goNo: 'QUD3',
    date: '10/03/1975',
    vehicleNo: 'Ad saepe eiusmod aut',
    driverName: 'Maxime molestiae ex',
    driverPhone: '03111234567',
    driverCnic: '35202-4411223-2',
    customerName: 'Bilal',
    address: 'Mollitia dolor incid',
    note: '',
    numbering: '',
    batchNumber: '',
    items: [
      { source: 'Main Warehouse', productId: 2, productName: '72 MM Seal', brand: 'Handi', quantity: 5, unit: 'Cartons' },
    ],
  },
  {
    id: 4,
    goNo: 'QUD4',
    date: '15/09/2000',
    vehicleNo: 'In et officia harum',
    driverName: 'Qui nostrud et dolor',
    driverPhone: '03331234567',
    driverCnic: '35202-2222333-4',
    customerName: 'Hudaibiya',
    address: 'Ut illum totam fugi',
    note: '',
    numbering: '',
    batchNumber: '',
    items: [
      { source: 'Main Warehouse', productId: 1, productName: '69 mm seal', brand: 'General', quantity: 2, unit: 'Unit' },
    ],
  },
]

