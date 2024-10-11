//Kalaw rectangle Polygon draw on GEE give name Kalaw

var Sentinel_Sar = ee.ImageCollection("COPERNICUS/S1_GRD");

// Filter the Sentinel SAR collection
var filtered_collection = ee.ImageCollection(Sentinel_Sar)
  .filterBounds(Kalaw)
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.or(
    ee.Filter.eq('orbitProperties_pass', 'DESCENDING'),
    ee.Filter.eq('orbitProperties_pass', 'ASCENDING')
  ));

var goodState = filtered_collection.filterDate('2024-08-01', '2024-08-31');
var floodState = filtered_collection.filterDate('2024-09-01', '2024-09-30');
print(goodState.size());

// Convert to/from natural units
function toNatural(img) {
  return ee.Image(10.0).pow(img.select(0).divide(10.0));
}

function toDB(img) {
  return ee.Image(img).log10().multiply(10.0);
}

// Apply median filter instead of Refined Lee
function applyMedianFilter(img) {
  return img.focal_median({radius: 3, units: 'pixels'});
}

var goodImage = goodState.select('VH').mosaic().clip(Kalaw);
var floodImage = floodState.select('VH').mosaic().clip(Kalaw);

var goodFilter = toDB(applyMedianFilter(toNatural(goodImage)));
var floodFilter = toDB(applyMedianFilter(toNatural(floodImage)));

// Define visualization parameters
var visParams = {min: -25, max: 0, palette: ['blue', 'white', 'green']};

// Create a map
var map = ui.Map();

// Add layers to the map
var goodLayer = ui.Map.Layer(goodFilter, visParams, "Good State");
var floodLayer = ui.Map.Layer(floodFilter, visParams, "Flood State");
map.add(goodLayer);
map.add(floodLayer);

// Center the map
map.centerObject(Kalaw, 14);


// Create labels for the sliders
var goodLabel = ui.Label('Good State Opacity:');
var floodLabel = ui.Label('Flood State Opacity:');


// Add a legend
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }
});

var legendTitle = ui.Label({
  value: 'SAR Backscatter (dB)',
  style: {fontWeight: 'bold', fontSize: '18px', margin: '0 0 4px 0', padding: '0'}
});
legend.add(legendTitle);

var makeRow = function(color, name) {
  var colorBox = ui.Label({
    style: {
      backgroundColor: color,
      padding: '8px',
      margin: '0 0 4px 0'
    }
  });
  var description = ui.Label({
    value: name,
    style: {margin: '0 0 4px 6px'}
  });
  return ui.Panel({
    widgets: [colorBox, description],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
};

var palette = visParams.palette;
var min = visParams.min;
var max = visParams.max;

legend.add(makeRow(palette[0], 'Low (' + min + ' dB)'));
legend.add(makeRow(palette[1], 'Medium'));
legend.add(makeRow(palette[2], 'High (' + max + ' dB)'));

map.add(legend);

// Set the map as the root UI element
ui.root.clear();
ui.root.add(map);