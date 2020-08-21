# dtable-sdk

JavaScript SDK for SeaTable (DTable is an old name).

## Adding to your poject

Using npm:

~~~bash
npm i dtable-sdk --save
~~~

## Basic demo

Prepare a test base, just like:

| Name | Result |
| ---- | ------ |
| Mike |        |
| Judy |        |

Create a base with a table named `sayHello` and a view named `Default_View`. Then, add a long text column named `Result`. Add a few rows and create a name for each row. Leave the `Result` column blank.

Then, generate an APIToken and change the `example/example.json` file like the code below:

~~~json
{
    "APIToken": "xxxxxxxx",
    "server": "http://127.0.0.1:8001",
    "workspaceID": "xxxxxxxx",
    "dtableName": "xxxxxxxx",
    "licenseGeneratorToken": "xxxxxxxx"
}
~~~

Run `npm run example` and wait for a few seconds. You will see result column has changed to something similar to this:

| Name | Result     |
| ---- | ---------- |
| Mike | Hello Mike |
| Judy | Hello Judy |
