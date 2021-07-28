'use strict';

// native
var querystring = require('querystring');
var pathModule = require('path').posix;

// local
var restHelper = require('./restHelper');
var v2 = require('./v2');
var odataHelper = require('./odataHelper');

var WELL_KNOWN_METHODS = restHelper.WELL_KNOWN_METHODS;
var ORGANIZATION_UNIT_ID_HEADER = 'x-uipath-organizationunitid';
/** @enum {string} */
var CLOUD_PLATFORM = {
    clientId: '5v7PmPJL6FOGu6RB8I1Y4adLBhIwovQN',
    hostname: 'account.uipath.com',
    tokenPath: '/oauth/token',
    platformHostname: 'platform.uipath.com'
};

/**
 * @param {OrchestratorOptions} options
 * @returns {OrchestratorOptions}
 */
const :[fn~\w+] = (options) => {
    if (!options) {
        throw new Error('OrchestratorOptions cannot be undefined');
    }
    // Default to secure connection
    if (options.isSecure !== true && options.isSecure !== false) {
        options.isSecure = true;
    }
    if (isNaN(options.connectionPool) || typeof options.connectionPool !== 'number' || options.connectionPool < 0) {
        options.connectionPool = 1;
    }
    if (!options.path) { // handles null, undefined, or ''
        options.path = '/';
    } else {
        options.path = pathModule.normalize(pathModule.join('/', options.path));
    }
    if ((options.serviceInstanceLogicalName || options.accessToken) && !options.hostname) {
        options.hostname = CLOUD_PLATFORM.platformHostname;
    }
    return options;
}

/**
 * @param {OrchestratorOptions} options
 * @constructor
 */
const :[fn~\w+] = (options) => {
    /**
     * @type {OrchestratorOptions}
     * @private
     */
    this._options = validateOptions(options);
    /**
     * @type {Array.<OrchestratorQueueElement>}
     * @private
     */
    this._queue = [];
    /**
     * @type {string|undefined}
     * @private
     */
    this._credentials = undefined;
    /** @type {V2RestGroup} */
    this.v2 = v2.v2Factory(this);
    /**
     * @type {Agent|undefined}
     * @private
     */
    this._agent = undefined;
    if (options.invalidCertificate) {
        this._agent = restHelper.createAgent(options.isSecure, options.invalidCertificate);
    }
    /**
     * @type {Array.<function(Error=)>}
     * @private
     */
    this._loginCallbackList = [];
    /**
     * @type {number}
     * @private
     */
    this._pendingRequestCount = 0;
    /**
     * @type {number}
     * @private
     */
    this._activeOrganizationUnitId = -1;
}

Orchestrator.odataHelper = odataHelper;
module.exports = Orchestrator;

/** @param {number} [organizationUnitId] set the active OU (empty to clear) */
Orchestrator.prototype.switchOrganizationUnitId = function (organizationUnitId) {
    if (organizationUnitId === undefined) {
        this._activeOrganizationUnitId = -1;
    } else {
        this._activeOrganizationUnitId = organizationUnitId;
    }
};

/** @private */
Orchestrator.prototype._getAccessToken = function () {
    var self = this;
    /** @type {Array<function(Error=)>} */
    var loginCallbackList = self._loginCallbackList;
    self._loginCallbackList = [];
    
    if(this._options.accessToken) {
        self._credentials = this._options.accessToken;
        for (var i = 0; i < loginCallbackList.length; i += 1) {
            loginCallbackList[i]();
        }
        return;
    }
    var requestOptions = {
        hostname: CLOUD_PLATFORM.hostname,
        isSecure: true,
        path: CLOUD_PLATFORM.tokenPath,
        agent: this._agent
    };
    var accessTokenRequestData = {
        "grant_type": "refresh_token",
        "client_id": this._options.clientId || CLOUD_PLATFORM.clientId,
        "refresh_token": this._options.refreshToken
    };
    restHelper.postJSON(
        requestOptions,
        accessTokenRequestData,
        /**
         * @param {Error} err
         * @param {{access_token: string}} response
         */
        function (err, response) {
            var i;
            if (!err) {
                self._credentials = response.access_token;
            }
            for (i = 0; i < loginCallbackList.length; i += 1) {
                loginCallbackList[i](err);
            }
        }
    );
};

/**
 * @private
 * @param {function(Error=)} callback
 */
Orchestrator.prototype._login = function (callback) {
    var self = this;
    /** @type {OrchestratorOptions} */
    var options;
    /** @type {OrchestratorRestHelperOptions} */
    var requestOptions;
    /** @type {Object} */
    var loginRequestData;

    this._loginCallbackList.push(callback);
    if (this._loginCallbackList.length > 1) {
        // a request is already ongoing
        return;
    }
    options = this._options;
    // handle the special case of Cloud Platform login
    if (options.serviceInstanceLogicalName || options.accessToken) {
        this._getAccessToken();
        return;
    }
    requestOptions = {
        hostname: options.hostname,
        isSecure: options.isSecure,
        invalidCertificate: options.invalidCertificate,
        port: options.port,
        path: pathModule.join(options.path, '/api/Account/Authenticate'),
        agent: this._agent
    };
    loginRequestData = {
        'TenancyName': options.tenancyName,
        'UsernameOrEmailAddress': options.usernameOrEmailAddress,
        'Password': options.password
    };
    restHelper.postJSON(
        requestOptions,
        loginRequestData,
        /**
         * @param {Error} err
         * @param {OrchestratorLoginResponse} response
         */
        function (err, response) {
            var i;
            /** @type {Array<function(Error=)>} */
            var loginCallbackList = self._loginCallbackList;

            self._loginCallbackList = [];
            if (!err) {
                self._credentials = response.result || response.Result;
            }
            for (i = 0; i < loginCallbackList.length; i += 1) {
                loginCallbackList[i](err);
            }
        }
    );
};


/**
 * @param {OrchestratorRestHelperCallback} callback
 * @param {Error} err
 * @param {Object} [data]
 * @private
 */
Orchestrator.prototype._triggerQueueElementCallback = function (callback, err, data) {
    // Use a try-finally to make sure the application code does not interrupt the queue
    try {
        callback(err, data);
    } finally {
        this._pendingRequestCount -= 1;
        this._processQueue();
    }
};

/**
 * @param {OrchestratorQueueElement} element
 * @param {boolean} isRetry
 * @returns {OrchestratorRestHelperCallback}
 */
Orchestrator.prototype._processingResultHandlerFactory = function (element, isRetry) {
    var self = this;
    return function (err, data) {
        if (err && err.statusCode === 401 && !isRetry) {
            self._login(function (err) { // attempt to login before retrying
                if (err) {
                    self._credentials = undefined; // login failed so reset credentials
                    self._triggerQueueElementCallback(element.cb, err);
                    return;
                }
                // retry with new credentials
                self._processElement(element, true);
            });
            return;
        }
        // succeed or fail, but no retry
        self._triggerQueueElementCallback(element.cb, err, data);
    };
};

/**
 * @param {OrchestratorQueueElement} element
 * @param {boolean} isRetry
 * @private
 */
Orchestrator.prototype._processElement = function (element, isRetry) {
    /** @type {OrchestratorRestHelperOptions} */
    var options = element.options;

    options.headers = options.headers || {};
    options.headers.authorization = 'bearer ' + this._credentials; // TODO check if systematically needed
    if (this._options.serviceInstanceLogicalName) {
        options.headers['X-UIPATH-TenantName'] = this._options.serviceInstanceLogicalName;
    }
    if (this._activeOrganizationUnitId !== -1) {
        options.headers[ORGANIZATION_UNIT_ID_HEADER] = this._activeOrganizationUnitId;
    }
    switch (element.method) {
    case WELL_KNOWN_METHODS.GET:
        restHelper.getJSON(
            element.options,
            this._processingResultHandlerFactory(element, isRetry)
        );
        break;
    case WELL_KNOWN_METHODS.POST:
        restHelper.postJSON(
            element.options,
            element.data,
            this._processingResultHandlerFactory(element, isRetry)
        );
        break;
    case WELL_KNOWN_METHODS.PUT:
        restHelper.putJSON(
            element.options,
            element.data,
            this._processingResultHandlerFactory(element, isRetry)
        );
        break;
    case WELL_KNOWN_METHODS.PATCH:
        restHelper.patchJSON(
            element.options,
            element.data,
            this._processingResultHandlerFactory(element, isRetry)
        );
        break;
    case WELL_KNOWN_METHODS.DELETE:
        restHelper.delete(
            element.options,
            this._processingResultHandlerFactory(element, isRetry)
        );
        break;
    default:
        element.cb(new Error('Method not supported: ' + element.method));
    }
};

/** @private */
Orchestrator.prototype._processQueue = function () {
    var self = this;
    /** @type {OrchestratorQueueElement|undefined} */
    var element;

    if (this._options.connectionPool > 0 && this._pendingRequestCount >= this._options.connectionPool) {
        return;
    }
    element = this._queue.shift();
    if (element === undefined) { // nothing left to process
        return;
    }
    this._pendingRequestCount += 1;
    if (this._credentials) { // already logged-in, move on to processing the element
        this._processElement(element, false); // credentials may be expired
        return;
    }
    this._login(function (err) { // attempt to login before processing
        if (err) {
            self._triggerQueueElementCallback(element.cb, err);
            return;
        }
        self._processElement(element, true); // credentials are expected to work
    });
};

/**
 * @param {WELL_KNOWN_METHODS} method
 * @param {string} path
 * @param {Object} data
 * @param {function(err: Error|undefined, response: Object=)} callback
 * @private
 */
Orchestrator.prototype._methodWrapper = function (method, path, data, callback) {
    /** @type {OrchestratorOptions} */
    var options = this._options;

    this._queue.push({
        method: method,
        options: {
            hostname: options.hostname,
            isSecure: options.isSecure,
            port: options.port,
            path: pathModule.join(options.path, path),
            agent: this._agent,
            invalidCertificate: options.invalidCertificate
        },
        data: data,
        cb: callback
    });
    this._processQueue();
};

// TODO add options (e.g. headers?, organizationUnitId, etc...)

/**
 * @param {string} path
 * @param {Object.<string|Array.<string>>} query
 * @param {function(err: Error|undefined, response: Object=)} callback
 */
Orchestrator.prototype.get = function (path, query, callback) {
    /** @type {string} */
    var pathWithQuery;

    if (Object.keys(query).length > 0) {
        pathWithQuery = path + '?' + querystring.encode(query);
    } else {
        pathWithQuery = path;
    }

    this._methodWrapper(
        WELL_KNOWN_METHODS.GET,
        pathWithQuery,
        undefined,
        callback
    );
};

/**
 * @param {string} path
 * @param {Object} data
 * @param {function(err: Error|undefined, response: Object=)} callback
 */
Orchestrator.prototype.post = function (path, data, callback) {
    this._methodWrapper(
        WELL_KNOWN_METHODS.POST,
        path,
        data,
        callback
    );
};

/**
 * @param {string} path
 * @param {Object} data
 * @param {function(err: Error|undefined, response: Object=)} callback
 */
Orchestrator.prototype.put = function (path, data, callback) {
    this._methodWrapper(
        WELL_KNOWN_METHODS.PUT,
        path,
        data,
        callback
    );
};

/**
 * @param {string} path
 * @param {Object} data
 * @param {function(err: Error|undefined, response: Object=)} callback
 */
Orchestrator.prototype.patch = function (path, data, callback) {
    this._methodWrapper(
        WELL_KNOWN_METHODS.PATCH,
        path,
        data,
        callback
    );
};

/**
 * @param {string} path
 * @param {function(err: Error|undefined, response: Object=)} callback
 */
Orchestrator.prototype.delete = function (path, callback) {
    this._methodWrapper(
        WELL_KNOWN_METHODS.DELETE,
        path,
        undefined,
        callback
    );
};

/**
 * @typedef {Object} OrchestratorOptions
 * @property {string} tenancyName
 * @property {string} usernameOrEmailAddress
 * @property {string} password
 * @property {string} hostname
 * @property {boolean|undefined} isSecure
 * @property {number|undefined} port
 * @property {boolean|undefined} invalidCertificate
 * @property {number|undefined} connectionPool - 0=unlimited (Default: 1)
 * @property {string|undefined} path - (Default: /)
 * @property {string|undefined} refreshToken
 * @property {string|undefined} serviceInstanceLogicalName
 * @property {string|undefined} clientId
 * @property {string|undefined} accessToken
 */

/**
 * @typedef {Object} OrchestratorResponseBase
 * @property {string|null} targetUrl
 * @property {boolean} success
 * @property {string|null} error
 * @property {boolean} unAuthorizedRequest
 */

/**
 * @typedef {OrchestratorResponseBase} OrchestratorLoginResponse
 * @property {string|undefined} result - The token value for 2017.1 and before
 * @property {string|undefined} Result - The token value for 2018.1 and later
 */

/**
 * @typedef {Object} OrchestratorQueueElement
 * @property {WELL_KNOWN_METHODS} method
 * @property {OrchestratorRestHelperOptions} options
 * @property {Object|undefined} data
 * @property {OrchestratorRestHelperCallback} cb
 */
