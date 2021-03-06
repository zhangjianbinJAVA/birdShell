define(function (require) {
  return function MapFactory(Private, tilemap, $sanitize) {
    var _ = require('lodash');
    var $ = require('jquery');
    var L = require('leaflet');
    var marked = require('marked');
    marked.setOptions({
      gfm: true, // Github-flavored markdown
      sanitize: true // Sanitize HTML tags
    });

    //修改为５，默认展示地图，当值为２是默认展示空白
    //var defaultMapZoom = 2;
    var defaultMapZoom = 5;
    //修改默认展示中国地图的位置
    //var defaultMapCenter = [15, 5];
    var defaultMapCenter = [32.97180377635759, 108.28125];
    var defaultMarkerType = 'Scaled Circle Markers';

    var tilemapOptions = tilemap.options;
    var attribution = $sanitize(marked(tilemapOptions.attribution));

    var mapTiles = {
      //url: tilemap.url,
      //options: _.assign({}, tilemapOptions, { attribution })
      // 替换成高德地图，参数：lang指定显示语言；style指定地图的风格，一般使用7
      url: 'http://webst0{s}.is.autonavi.com/appmaptile?lang=zh_cn&style=7&x={x}&y={y}&z={z}',
      options: {
        attribution: 'Tiles by <a href="http://www.mapquest.com/">MapQuest</a> &mdash; ' +
          'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
          '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
        subdomains: '1234'
      }
    };

    var markerTypes = {
      'Scaled Circle Markers': Private(require('ui/vislib/visualizations/marker_types/scaled_circles')),
      'Shaded Circle Markers': Private(require('ui/vislib/visualizations/marker_types/shaded_circles')),
      'Shaded Geohash Grid': Private(require('ui/vislib/visualizations/marker_types/geohash_grid')),
      'Heatmap': Private(require('ui/vislib/visualizations/marker_types/heatmap')),
    };

    /**
     * Tile Map Maps
     *
     * @class Map
     * @constructor
     * @param container {HTML Element} Element to render map into
     * @param chartData {Object} Elasticsearch query results for this map
     * @param params {Object} Parameters used to build a map
     */
    function TileMapMap(container, chartData, params) {
      this._container = $(container).get(0);
      this._chartData = chartData;

      // keep a reference to all of the optional params
      this._events = _.get(params, 'events');
      this._markerType = markerTypes[params.markerType] ? params.markerType : defaultMarkerType;
      this._valueFormatter = params.valueFormatter || _.identity;
      this._tooltipFormatter = params.tooltipFormatter || _.identity;
      this._geoJson = _.get(this._chartData, 'geoJson');
      this._attr = params.attr || {};

      var mapOptions = {
        minZoom: tilemapOptions.minZoom,
        maxZoom: tilemapOptions.maxZoom,
        noWrap: true,
        maxBounds: L.latLngBounds([-90, -220], [90, 220]),
        scrollWheelZoom: false,
        fadeAnimation: false,
      };

      this._createMap(mapOptions);
    }

    TileMapMap.prototype.addBoundingControl = function () {
      if (this._boundingControl) return;

      var self = this;
      var drawOptions = { draw: {} };

      _.each(['polyline', 'polygon', 'circle', 'marker', 'rectangle'], function (drawShape) {
        if (self._events && !self._events.listenerCount(drawShape)) {
          drawOptions.draw[drawShape] = false;
        } else {
          drawOptions.draw[drawShape] = {
            shapeOptions: {
              stroke: false,
              color: '#000'
            }
          };
        }
      });

      this._boundingControl = new L.Control.Draw(drawOptions);
      this.map.addControl(this._boundingControl);
    };

    TileMapMap.prototype.addFitControl = function () {
      if (this._fitControl) return;

      var self = this;
      var fitContainer = L.DomUtil.create('div', 'leaflet-control leaflet-bar leaflet-control-fit');

      // Add button to fit container to points
      var FitControl = L.Control.extend({
        options: {
          position: 'topleft'
        },
        onAdd: function (map) {
          $(fitContainer).html('<a class="fa fa-crop" href="#" title="Fit Data Bounds"></a>')
          .on('click', function (e) {
            e.preventDefault();
            self._fitBounds();
          });

          return fitContainer;
        },
        onRemove: function (map) {
          $(fitContainer).off('click');
        }
      });

      this._fitControl = new FitControl();
      this.map.addControl(this._fitControl);
    };

    /**
     * Adds label div to each map when data is split
     *
     * @method addTitle
     * @param mapLabel {String}
     * @return {undefined}
     */
    TileMapMap.prototype.addTitle = function (mapLabel) {
      if (this._label) return;

      var label = this._label = L.control();

      label.onAdd = function () {
        this._div = L.DomUtil.create('div', 'tilemap-info tilemap-label');
        this.update();
        return this._div;
      };
      label.update = function () {
        this._div.innerHTML = '<h2>' + _.escape(mapLabel) + '</h2>';
      };

      // label.addTo(this.map);
      this.map.addControl(label);
    };

    /**
     * remove css class for desat filters on map tiles
     *
     * @method saturateTiles
     * @return undefined
     */
    TileMapMap.prototype.saturateTiles = function () {
      if (!this._attr.isDesaturated) {
        $('img.leaflet-tile-loaded').addClass('filters-off');
      }
    };

    TileMapMap.prototype.updateSize = function () {
      this.map.invalidateSize({
        debounceMoveend: true
      });
    };

    TileMapMap.prototype.destroy = function () {
      if (this._label) this._label.removeFrom(this.map);
      if (this._fitControl) this._fitControl.removeFrom(this.map);
      if (this._boundingControl) this._boundingControl.removeFrom(this.map);
      if (this._markers) this._markers.destroy();
      this.map.remove();
      this.map = undefined;
    };

    /**
     * Switch type of data overlay for map:
     * creates featurelayer from mapData (geoJson)
     *
     * @method _addMarkers
     */
    TileMapMap.prototype._addMarkers = function () {
      if (!this._geoJson) return;
      if (this._markers) this._markers.destroy();

      this._markers = this._createMarkers({
        tooltipFormatter: this._tooltipFormatter,
        valueFormatter: this._valueFormatter,
        attr: this._attr
      });

      if (this._geoJson.features.length > 1) {
        this._markers.addLegend();
      }
    };

    /**
     * Create the marker instance using the given options
     *
     * @method _createMarkers
     * @param options {Object} options to give to marker class
     * @return {Object} marker layer
     */
    TileMapMap.prototype._createMarkers = function (options) {
      var MarkerType = markerTypes[this._markerType];
      return new MarkerType(this.map, this._geoJson, options);
    };

    TileMapMap.prototype._attachEvents = function () {
      var self = this;
      var saturateTiles = self.saturateTiles.bind(self);

      this._tileLayer.on('tileload', saturateTiles);

      this.map.on('unload', function () {
        self._tileLayer.off('tileload', saturateTiles);
      });

      this.map.on('moveend', function setZoomCenter(ev) {
        if (!self.map) return;
        // update internal center and zoom references
        self._mapCenter = self.map.getCenter();
        self._mapZoom = self.map.getZoom();
        self._addMarkers();

        if (!self._events) return;

        self._events.emit('mapMoveEnd', {
          chart: self._chartData,
          map: self.map,
          center: self._mapCenter,
          zoom: self._mapZoom,
        });
      });

      this.map.on('draw:created', function (e) {
        var drawType = e.layerType;
        if (!self._events || !self._events.listenerCount(drawType)) return;

        // TODO: Different drawTypes need differ info. Need a switch on the object creation
        var bounds = e.layer.getBounds();

        self._events.emit(drawType, {
          e: e,
          chart: self._chartData,
          bounds: {
            top_left: {
              lat: bounds.getNorthWest().lat,
              lon: bounds.getNorthWest().lng
            },
            bottom_right: {
              lat: bounds.getSouthEast().lat,
              lon: bounds.getSouthEast().lng
            }
          }
        });
      });

      this.map.on('zoomend', function () {
        if (!self.map) return;
        self._mapZoom = self.map.getZoom();
        if (!self._events) return;

        self._events.emit('mapZoomEnd', {
          chart: self._chartData,
          map: self.map,
          zoom: self._mapZoom,
        });
      });
    };

    TileMapMap.prototype._createMap = function (mapOptions) {
      if (this.map) this.destroy();

      if (this._attr.wms && this._attr.wms.enabled) {
        _.assign(mapOptions, {
          minZoom: 1,
          maxZoom: 18
        });
      }

      const savedZoom = _.get(this._geoJson, 'properties.zoom');

      // get center and zoom from mapdata, or use defaults
      this._mapCenter = _.get(this._geoJson, 'properties.center') || defaultMapCenter;
      this._mapZoom = Math.max(Math.min(savedZoom || defaultMapZoom, mapOptions.maxZoom), mapOptions.minZoom);

      // add map tiles layer, using the mapTiles object settings
      if (this._attr.wms && this._attr.wms.enabled) {
        this._tileLayer = L.tileLayer.wms(this._attr.wms.url, this._attr.wms.options);
      } else {
        this._tileLayer = L.tileLayer(mapTiles.url, mapTiles.options);
      }

      // append tile layers, center and zoom to the map options
      mapOptions.layers = this._tileLayer;
      mapOptions.center = this._mapCenter;
      mapOptions.zoom = this._mapZoom;

      this.map = L.map(this._container, mapOptions);
      this._attachEvents();
      this._addMarkers();
    };

    /**
     * zoom map to fit all features in featureLayer
     *
     * @method _fitBounds
     * @param map {Leaflet Object}
     * @return {boolean}
     */
    TileMapMap.prototype._fitBounds = function () {
      this.map.fitBounds(this._getDataRectangles());
    };

    /**
     * Get the Rectangles representing the geohash grid
     *
     * @return {LatLngRectangles[]}
     */
    TileMapMap.prototype._getDataRectangles = function () {
      if (!this._geoJson) return [];
      return _.pluck(this._geoJson.features, 'properties.rectangle');
    };

    return TileMapMap;
  };
});
