/**
 * Class: TiledVectorLayer
 * SuperMap iServer的矢量瓦片图层
 * 用法：
 *      L.superMap.tiledVectorLayer(url).addTo(map);
 */
require('../core/Base');
require('./vectortile/VectorGrid');
var L = require("leaflet");
var CartoCSSToLeaflet = require('./carto/CartoCSSToLeaflet');

var TileVectorLayer = L.VectorGrid.extend({

    options: {
        url: null,
        token: null,
        cartoCSS: null,
        // 指定图层的名称列表。支持的类型为矢量图层
        layerNames: null,
        //获取进行切片的地图图层 ID
        layersID: null,

        //是否服务端CartoCSS样式，默认使用
        serverCartoCSSStyle: true,

        returnAttributes: false,
        cacheEnabled: false,

        crs: null,
        timeout: 10000,
        attribution: ' with <a href="http://icltest.supermapol.com/">SuperMap iClient</a>'
    },

    initialize: function (url, options) {
        options = options || {};
        options.noWrap = true;
        L.VectorGrid.prototype.initialize.call(this, options);
        L.Util.setOptions(this, options);
        var me = this;
        L.stamp(me);

        me.options.url = url;
        if (url && url.indexOf("/") === (url.length - 1)) {
            url = url.substr(0, url.length - 1);
            me.options.url = url;
        }
        me._initLayerUrl();
        me.initMapScales();
        me.initLayersInfo();
        CartoCSSToLeaflet.mapUrl = me.options.url;
        if (!me.options.serverCartoCSSStyle && me.options) {
            me.setClientCartoCSS(me.options.cartoCSS);
        }
    },

    //如果不设置获取服务器的cartoCSS情况下，则直接初始化瓦片网格
    //如果设置了需获取服务器的cartoCSS情况下，待服务器返回cartocss之后再初始化瓦片网格
    onAdd: function (map) {
        this._crs = this.options.crs || map.options.crs;
        this._map = map;
        if (!this.options.serverCartoCSSStyle) {
            this._initGrid();
        }
    },

    //主要设置scales
    initMapScales: function () {
        var me = this;
        var mapUrl = me.options.url + ".json";
        SuperMap.Request.get(mapUrl, null, {
            timeout: me.options.timeout
        }).then(function (response) {
            return response.json();
        }).then(function (json) {
            me._initScales(json);
        }).catch(function (ex) {
            console.error('error', ex)
        });
    },

    //获取服务器layers资源下的风格信息(当CartoCSS中不存在相应图层渲染信息时使用)
    initLayersInfo: function () {
        var me = this;
        var layersUrl = me.options.url + "/layers.json";
        SuperMap.Request.get(layersUrl, null, {
            timeout: me.options.timeout
        }).then(function (response) {
            return response.json();
        }).then(function (json) {
            me.layersInfoInitialized = true;
            me.layersInfo = json;
            if (!me.layersInfo) {
                return;
            }
            var layersInfo = {};
            for (var i = 0, len = me.layersInfo.length; i < len; i++) {
                var layers = me.layersInfo[i].subLayers.layers;
                for (var j = 0, len1 = layers.length; j < len1; j++) {
                    layers[j].layerIndex = len1 - j;
                    layersInfo[layers[j].name] = layers[j];
                }
            }
            me.layersInfo = layersInfo;
            if (me.options.serverCartoCSSStyle) {
                me.getVectorStylesFromServer();
            }
        }).catch(function (ex) {
            console.error('error', ex)
        });
    },

    getLayerStyleInfo: function (layerName) {
        var me = this, layerInfo_simple;
        me.layersStyles = me.layersStyles || {};

        layerInfo_simple = me.layersStyles[layerName];
        if (layerInfo_simple) {
            return layerInfo_simple;
        }

        if (!me.layersInfo) {
            return null;
        }
        var layerInfo = me.layersInfo[layerName];
        if (!layerInfo)return null;
        layerInfo_simple = {layerIndex: layerInfo.layerIndex, ugcLayerType: layerInfo.ugcLayerType};
        switch (layerInfo.ugcLayerType) {
            case "VECTOR":
                layerInfo_simple.layerStyle = layerInfo.style ? layerInfo.style : null;
                break;
            case "THEME":
                var theme = layerInfo.theme;
                //标注图层特别标明
                layerInfo_simple.layerStyle = theme ? theme.defaultStyle : null;
                if (theme && theme.type === "LABEL") {
                    layerInfo_simple.type = theme.type;
                    layerInfo_simple.textField = theme.labelExpression;
                }
                break;
            default :
                //SVTile发布出来的地图没有ugcLayerType属性
                if (layerInfo.style) {
                    layerInfo_simple.layerStyle = layerInfo.style;
                }
                break;
        }
        me.layersStyles[layerName] = layerInfo_simple;
        return layerInfo_simple;
    },

    //等待服务器的carto返回之后拼接本地配置的cartoCSS,并调用onAdd出图
    getVectorStylesFromServer: function () {
        var me = this;
        var vectorStyleUrl = me.options.url + "/tileFeature/vectorstyles.json";
        SuperMap.Request.get(vectorStyleUrl, null, {
            timeout: me.options.timeout
        }).then(function (response) {
            return response.json()
        }).then(function (styles) {
            if (!styles || !styles.style) {
                return null;
            }
            if (styles.style && styles.type === 'cartoCSS') {
                me.setServerCartoCSS(styles.style);
            }
            if (me.options) {
                me.setClientCartoCSS(me.options.cartoCSS);
            }
            me._initGrid();
        }).catch(function (ex) {
            console.error('error', ex)
        });
    },

    setServerCartoCSS: function (cartoCSSStr) {
        CartoCSSToLeaflet.pretreatedCartoCSS(cartoCSSStr, true);
    },
    setClientCartoCSS: function (cartoCSSStr) {
        CartoCSSToLeaflet.pretreatedCartoCSS(cartoCSSStr, false);
    },

    //获取图层风格信息，当CartoCSS中包含有对该图层的渲染信息时，优先获取
    //否则获取layers资源下layerSytle的渲染信息
    getVectorTileLayerStyle: function (coords, feature) {
        if (!feature) {
            return null;
        }
        var me = this,
            layerName = feature.layerName,
            layerStyleInfo = me.getLayerStyleInfo(layerName);

        //处理标签图层
        if (layerStyleInfo.textField) {
            feature.properties.textField = layerStyleInfo.textField;
        }

        me.vectorTileLayerStyles = me.vectorTileLayerStyles || {};

        var style = me.vectorTileLayerStyles[layerName];
        if (style) {
            return style;
        }

        // SuperMap.CartoCSSToLeaflet内部做了客户端配置的cartoCSS和服务端cartoCSS的拼接处理
        // 客户端配置的cartoCSS会覆盖相应图层的服务端cartoCSS
        if (!style && feature.type !== "TEXT") {
            var scale = this.getScale(coords);
            var shaders = CartoCSSToLeaflet.pickShader(layerName) || [];
            style = [];
            for (var itemKey in shaders) {
                var shader = shaders[itemKey];
                for (var j = 0; j < shader.length; j++) {
                    var serverStyle = CartoCSSToLeaflet.getValidStyleFromCarto(coords.z, scale, shader[j], feature);
                    if (serverStyle) {
                        style.push(serverStyle);
                    }
                }
            }
        }

        //次优先级是layers资源的默认的样式，最低优先级是CartoDefaultStyle的样式
        if (!style || style.length < 1) {
            style = CartoCSSToLeaflet.getValidStyleFromLayerInfo(feature, layerStyleInfo);
        }

        me.vectorTileLayerStyles[layerName] = style;
        return style;
    },


    setScales: function (scales) {
        this.scales = scales || this.scales;
    },

    getScale: function (coords) {
        var me = this, scale;
        if (me.scales && me.scales[coords.z]) {
            return me.scales[coords.z];
        }
        me.scales = me.scales || {};
        scale = me.getDefaultScale(coords);
        me.scales[coords.z] = scale;
        return scale;
    },

    getDefaultScale: function (coords) {
        var me = this, crs = me._crs;
        var tileBounds = me._tileCoordsToBounds(coords);
        var ne = crs.project(tileBounds.getNorthEast());
        var sw = crs.project(tileBounds.getSouthWest());
        var tileSize = me.options.tileSize;
        var resolution = Math.max(
            Math.abs(ne.x - sw.x) / tileSize,
            Math.abs(ne.y - sw.y) / tileSize
        );
        return 0.0254 / (96 * resolution);
    },

    _initGrid: function () {
        L.VectorGrid.prototype.onAdd.call(this, this._map);
    },

    _initScales: function (mapInfo) {
        var me = this;
        me.scales = mapInfo.visibleScales;
        if (!me.scales) {
            return null;
        }
        var viewBounds = mapInfo.viewBounds,
            coordUnit = mapInfo.coordUnit,
            viewer = mapInfo.viewer,
            scale = mapInfo.scale,
            datumAxis = mapInfo.datumAxis;
        //将jsonObject转化为SuperMap.Bounds，用于计算dpi。
        viewBounds = new SuperMap.Bounds(viewBounds.left, viewBounds.bottom, viewBounds.right, viewBounds.top);

        viewer = new SuperMap.Size(viewer.rightBottom.x, viewer.rightBottom.y);

        coordUnit = coordUnit.toLowerCase();
        me.units = me.units || coordUnit;
        me.datumAxis = datumAxis || 6378137;

        me.dpi = SuperMap.Util.calculateDpi(viewBounds, viewer, scale, me.units, datumAxis);
        me.resolutions = me._resolutionsFromScales(me.scales);
        var len = me.resolutions.length;
        me.scales = [len];
        for (var i = 0; i < len; i++) {
            me.scales[i] = SuperMap.Util.getScaleFromResolutionDpi(
                me.resolutions[i], me.dpi, me.units, me.datumAxis
            );
        }
    },

    _resolutionsFromScales: function (scales) {
        if (scales == null) {
            return;
        }
        var me = this,
            resolutions, len;
        len = scales.length;
        resolutions = [len];
        for (var i = 0; i < len; i++) {
            resolutions[i] = SuperMap.Util.getResolutionFromScaleDpi(
                scales[i], me.dpi, me.units, me.datumAxis);
        }
        return resolutions;
    },

    _getTileUrl: function (coords) {
        var x = coords.x, y = coords.y;
        var tileUrl = this._tileUrl + "&x=" + x + "&y=" + y;
        var scale = this.getScale(coords);
        tileUrl += "&scale=" + scale;
        return tileUrl;
    },

    _initLayerUrl: function () {
        var options = this.options;
        if (!options.url) {
            return;
        }
        this._tileUrl = options.url + "/tileFeature.json?";
        this._tileUrl += this._createURLParam(options);
    },

    _createURLParam: function (options) {
        var params = [];

        //为url添加安全认证信息片段
        if (options.token) {
            params.push("token=" + options.token);
        }
        if (options.layersID) {
            params.push("layersID=" + options.layersID);
        }
        if (options.layerNames) {
            params.push("layerNames=" + options.layerNames);
        }

        params.push("returnAttributes=" + options.returnAttributes);

        params.push("cacheEnabled=" + options.cacheEnabled);

        var tileSize = this.options.tileSize;
        params.push("width=" + tileSize);
        params.push("height=" + tileSize);
        return params.join("&");
    }
});

L.supermap.tiledVectorLayer = function (url, options) {
    return new TileVectorLayer(url, options);
};

module.exports = TileVectorLayer;