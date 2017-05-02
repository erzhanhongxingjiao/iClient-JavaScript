﻿/**
 * Class: SuperMap.REST.QueryBySQLService
 * SQL 查询服务类。在一个或多个指定的图层上查询符合 SQL 条件的空间地物信息。
 *
 * Inherits from:
 *  - <SuperMap.REST.QueryService>
 */
require('./QueryService');
require('./QueryBySQLParameters');
var SuperMap = require('../SuperMap');
SuperMap.REST.QueryBySQLService = SuperMap.Class(SuperMap.REST.QueryService, {

    /**
     * Constructor: SuperMap.REST.QueryBySQLService
     * SQL 查询服务类构造函数。
     *
     * 例如：
     * (start code)
     * var queryParam = new SuperMap.FilterParameter({
     *     name: "Countries@World.1",
     *     attributeFilter: "Pop_1994>1000000000 and SmArea>900"
     * });
     * var queryBySQLParams = new SuperMap.QueryBySQLParameters({
     *     queryParams: [queryParam]
     * });
     * var myQueryBySQLService = new SuperMap.REST.QueryBySQLService(url, {eventListeners: {
     *     "processCompleted": queryCompleted, 
     *     "processFailed": queryError
     *	   }
     * });
     * queryBySQLService.processAsync(queryBySQLParams);
     * function queryCompleted(object){//todo};
     * function queryError(object){//todo};
     * (end)
     *
     * Parameters:
     * url - {String} 服务的访问地址。如访问World Map服务，只需将url设为: http://localhost:8090/iserver/services/map-world/rest/maps/World+Map 即可。
     * options - {Object} 参数。
     *
     * Allowed options properties:
     * eventListeners - {Object} 需要被注册的监听器对象。
     */
    initialize: function (url, options) {
        SuperMap.REST.QueryService.prototype.initialize.apply(this, arguments);
    },

    /**
     * APIMethod: destroy
     * 释放资源，将引用资源的属性置空。
     */
    destroy: function () {
        SuperMap.REST.QueryService.prototype.destroy.apply(this, arguments);
    },

    /**
     * Method: getJsonParameters
     * 将查询参数转化为 JSON 字符串。
     * 在本类中重写此方法，可以实现不同种类的查询（sql, geometry, distance, bounds等）。
     *
     * Parameters:
     * params - {<SuperMap.QueryBySQLParameters>}
     *
     * Returns:
     * {Object} 转化后的 JSON 字符串。
     */
    getJsonParameters: function (params) {
        var me = this,
            jsonParameters = "",
            qp = null;
        qp = me.getQueryParameters(params);
        jsonParameters += "'queryMode':'SqlQuery','queryParameters':";
        jsonParameters += SuperMap.Util.toJSON(qp);
        jsonParameters = "{" + jsonParameters + "}";
        return jsonParameters;
    },

    CLASS_NAME: "SuperMap.REST.QueryBySQLService"
});

module.exports = SuperMap.REST.QueryBySQLService;