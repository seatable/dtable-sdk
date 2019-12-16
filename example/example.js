import fs from 'fs';
import path from 'path';
import DTable from '../src/dtable';
import Debug from 'debug';

const debug = Debug('dtable:say-hello');
const configPath = path.resolve(__dirname, './example.json');
const config = JSON.parse(fs.readFileSync(configPath).toString());
const { APIToken, server, workspaceID, dtableName, lang } = config;

let dtableConfig = {
  server: server.replace(/\/+$/, ""),
  APIToken,
  workspaceID,
  dtableName,
  lang,
};

class Test {
  constructor(dtable) {
    this.dtable = dtable;
  }
  sayHello() {
    let { dtable } = this;
    let table = dtable.getTableByName('sayHello');
    if (!table) return;
    dtable.forEachRow('sayHello', 'Default_View', (row) => { 
      let name = row['Name'];
      const res = `Hello ${name}`;
      if (row['Result'] && row['Result'].text === res) {
        debug(row['Result'].text, res);
        return;
      }
      let updated = {};
      updated['Result'] = res;
      dtable.modifyRow(table, row, updated);
      debug('change row data success');
    });
  }
}

let dtable = new DTable();
let test = new Test(dtable);

async function init() {
  await dtable.init(dtableConfig);
  dtable.subscribe('dtable-data-changed', () => { test.sayHello(); });
  await dtable.loadFromServer();
  dtable.syncWithServer();
}

init();
