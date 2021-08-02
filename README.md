# uipath-orchestrator

Wowee!

This is a Node.JS client for UiPath Orchestrator.

### Table of content

1. [Installation](#installation)
2. [Usage](#usage)
3. [TODO](#todo)
4. [License](#license)

### Installation

`npm install uipath-orchestrator`

### Usage

See the [wiki](https://github.com/UiPath/orchestrator-nodejs/wiki) page for a complete reference.

Orchestrator is a class and its constructor takes an `options` object.
```javascript
var util = require('util');
var Orchestrator = require('uipath-orchestrator');
var orchestrator = new Orchestrator({
     tenancyName: 'test',           // The Orchestrator Tenancy
     usernameOrEmailAddress: 'xxx',// The Orchestrator login
     password: 'yyy',               // The Orchestrator password
     hostname: 'host.company.com', // The instance hostname
     isSecure: true,                // optional (defaults to true)
     port: 443, // optional (defaults to 80 or 443 based on isSecure)
     invalidCertificate: false, // optional (defaults to false)
     connectionPool: 5 // options, 0=unlimited (defaults to 1)
});
var apiPath = '/odata/Users';
var apiQuery = {};
orchestrator.get(apiPath, apiQuery, function (err, data) {
    if (err) {
        console.error('Error: ' + err);
    }
    console.log('Data: ' + util.inspect(data));
});
```
The 5 supported basic methods are as follows:
```javascript
Orchestrator.get(path, query, callback);
Orchestrator.post(path, data, callback);
Orchestrator.put(path, data, callback);
Orchestrator.patch(path, data, callback);
Orchestrator.delete(path, callback);
```
where `query` is an querystring-ready *object*, and `data` a `JSON.stringify`able *object*.

These are very generic methods, and the plan is to keep version-dedicated helpers up-to-date in the following form:
```javascript
orchestrator.v2.api.postLogs(postLogsData, callback);
orchestrator.v2.odata.getUsers(getUsersQuery, callback);
``` 

It is possible to switch organization units (now called Folders) with the following method:
```javascript
orchestrator.switchOrganizationUnitId(1234);
```

You can also authentication in our Automation Cloud:
https://cloud.uipath.com/

In that case, you will need to use a different method of authentication (please see the [official documentation](https://docs.uipath.com/orchestrator/v0/reference/consuming-cloud-api))
The minimum configuration for Cloud Orchestrator access is as follows:
```javascript
new Orchestrator({
    refreshToken: 'qwertyuiopasdfghjkllzxcvbnmQWERTYUIOPASDFGHJK', // User Key
    clientId: 'qwertyuiopasdfghjkllzxcvbnmQWERTY',                 // Client ID
    serviceInstanceLogicalName: 'myInstanceLogicalName',           // Tenant Name
    path: 'myAccountLogicalName/myInstanceLogicalName'             // Account Name/Tenant Name
})
```

### TODO

This is just the beginning and there is a lot left to do.
If you have suggestions and ideas, please do not hesitate to let me know.
- [ ] Proper unit testing
- [X] Extend each API version
- [X] Write wiki
- [ ] Write TS definitions
- [X] Add DELETE method
- [X] Add PATCH method
- [X] Add OrganizationUnitId handling

### License

MIT
