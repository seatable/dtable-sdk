# dtable-sdk

SDK for dtable.

## Basic demo

Using npm


~~~bash
npm install
~~~

Prepare a test dtable, just like:

| Name | Result |
| ---- | ------ |
| Mike |        |
| Judy |        |

You shoule create a dtable with the table name 'sayHello' and view name 'Default_View'. Then add a new long text column named 'Result'. Add a few rows and enter some names.

Then generate APIToken and change example/example.json file just like below.

~~~json
{
    "APIToken": "xxxxxxxx",
    "server": "http://127.0.0.1:8001",
    "workspaceID": "xxxxxxxx",
    "dtableName": "xxxxxxxx",
    "lang": "en",
    "licenseGeneratorToken": "xxxxxxxx"
} 
~~~

Run `npm run example ` and wait for a few secones, you will see result column is changed.

| Name | Result     |
| ---- | ---------- |
| Mike | Hello Mike |
| Judy | Hello Judy |