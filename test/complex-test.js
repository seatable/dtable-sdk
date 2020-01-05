import DTable from '../src/dtable';
import Debug from 'debug';

const config = {
  APIToken: "xxx",
  server: "https://dev.seafile.com/dtable-web",
  workspaceID: "8",
  dtableName: "DTable任务安排",
  lang: "en",
}


class Test {
  constructor(dtable) {
    this.dtable = dtable;
  }

  printRows() {
    let { dtable } = this;
    dtable.forEachRow('前端功能', '未完成任务', (row) => {
      let name = row['Name'];
      console.log(name);
    });
  }
}

let dtable = new DTable();
let test = new Test(dtable);

async function init() {
  await dtable.init(config);
  dtable.subscribe('dtable-connect', () => { test.printRows(); });
  dtable.subscribe('dtable-data-changed', () => { test.printRows(); });
  await dtable.syncWithServer();
}

init();
