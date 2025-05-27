
var kalaw = ee.Geometry.Rectangle([96.5457,20.6080,96.5820,20.6466]);

// Load Sentinel-1 VH polarization, IW mode, any orbit
var sentinel1 = ee.ImageCollection("COPERNICUS/S1_GRD")
  .filterBounds(kalaw)
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
  .filter(ee.Filter.inList('orbitProperties_pass', ['ASCENDING', 'DESCENDING']));

// Date ranges for pre-flood (“good”) and flood states
var dateRanges = {
  good:  { start: '2024-08-01', end: '2024-08-31' },
  flood: { start: '2024-09-01', end: '2024-09-30' }
};

// Create a median VH composite for a given date range, clipped to the region
function getMedianComposite(collection, range) {
  return collection
    .filterDate(range.start, range.end)
    .select('VH')
    .median()
    .clip(kalaw);
}

// dB ↔ natural‐units conversions (needed to speckle‐filter correctly)
function toNatural(img) { return ee.Image(10).pow(img.divide(10)); }
function toDB(img)      { return img.log10().multiply(10); }

// Speckle reduction: median filter in natural units, then back to dB
function speckleFilter(img) {
  var nat = toNatural(img);
  var filtered = nat.focal_median({ radius: 3, units: 'pixels' });
  return toDB(filtered);
}

// Build the two composites
var goodRaw  = getMedianComposite(sentinel1, dateRanges.good);
var floodRaw = getMedianComposite(sentinel1, dateRanges.flood);

// Apply speckle filtering
var goodDB  = speckleFilter(goodRaw);
var floodDB = speckleFilter(floodRaw);

// Visualization params
var visParams = {
  min: -25, max: 0,
  palette: ['blue', 'white', 'green']
};

// Create map layers
var goodLayer  = ui.Map.Layer(goodDB,  visParams, 'Good State');
var floodLayer = ui.Map.Layer(floodDB, visParams, 'Flood State');

// Initialize map
var map = ui.Map();
map.add(goodLayer);
map.add(floodLayer);
map.centerObject(kalaw, 13);

// Opacity sliders
var goodSlider = ui.Slider({ min:0, max:1, value:0.7, step:0.01 });
goodSlider.onChange(function(val){ goodLayer.setOpacity(val); });
var floodSlider = ui.Slider({ min:0, max:1, value:0.7, step:0.01 });
floodSlider.onChange(function(val){ floodLayer.setOpacity(val); });

var controlPanel = ui.Panel([
  ui.Label('Good State Opacity'),  goodSlider,
  ui.Label('Flood State Opacity'), floodSlider
], ui.Panel.Layout.flow('vertical'), { position: 'top-right' });
map.add(controlPanel);

// Legend
var legend = ui.Panel({ style: { position:'bottom-left', padding:'8px', backgroundColor:'white' }});
legend.add(ui.Label('SAR Backscatter (dB)', { fontWeight:'bold' }));

[
  { color: visParams.palette[0], label: 'Low ('  + visParams.min + ' dB)' },
  { color: visParams.palette[1], label: 'Medium'               },
  { color: visParams.palette[2], label: 'High (' + visParams.max + ' dB)' }
].forEach(function(entry) {
  var row = ui.Panel([
    ui.Label('', { backgroundColor: entry.color, padding:'8px' }),
    ui.Label(entry.label, { margin:'0 0 4px 6px' })
  ], ui.Panel.Layout.Flow('horizontal'));
  legend.add(row);
});
map.add(legend);

// Set as the root UI
ui.root.clear();
ui.root.add(map);