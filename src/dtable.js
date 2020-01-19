import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { DTableStore, Views, TableUtils, RowUtils } from 'dtable-store';
import DTableServerAPI from './dtable-server-api';
import DTableWebAPI from './dtable-web-api';
import Debug from 'debug';

const debug = Debug('dtable:sdk');

const ACCESS_TOKEN_INTERVAL_TIME = (3 * 24 * 60 - 1) * 60 * 1000;

class DTable {
  constructor() {
    this.dtableStore = null;
    this.eventBus = null;
    this.dtableWebAPI = null;
    this.dtableServerAPI = null;
  }

  async init(config) {
    this.dtableWebAPI = new DTableWebAPI(config);
    this.config = config;

    try {
      let res = await this.dtableWebAPI.getDTableAccessToken();
      const { access_token, dtable_uuid, dtable_server, dtable_socket } = res.data;
      this.config.accessToken = access_token;
      this.config.dtableUuid = dtable_uuid;
      this.config.dtableServer = dtable_server.replace(/\/+$/, '') + '/';
      this.config.dtableSocket = dtable_socket.replace(/\/+$/, '') + '/';
      this.dtableServerAPI = new DTableServerAPI(this.config);
      this.dtableStore = new DTableStore(this.config);
      this.eventBus = this.dtableStore.eventBus;
    } catch (err) {
      console.log(err);
    }
  }

  initInBrowser(dtableStore, dtableServerAPI, dtableSettings) {
    let { dtableServer, dtableSocket, dtableUuid, accessToken } = dtableSettings;
    // init config
    this.config = {};
    this.config.dtableServer = dtableServer;
    this.config.dtableSocket = dtableSocket;
    this.config.dtableUuid = dtableUuid;
    this.config.accessToken = accessToken;

    // init tool object
    this.dtableStore = dtableStore;
    this.dtableServerAPI = dtableServerAPI;
    this.eventBus = this.dtableStore.eventBus;

  }

  async syncWithServer() {
    await this.dtableStore.loadFromServer();
    this.dtableStore.syncWithServer();
    this.updateDTableAccessToken();
  }

  updateDTableAccessToken() {
    setInterval(async () => {
      try {
        let res = await this.dtableWebAPI.getDTableAccessToken();
        this.dtableStore.updateAccessToken(res.data.access_token);
      } catch (err) {
        console.log(err);
      }
    }, ACCESS_TOKEN_INTERVAL_TIME);
  }

  subscribe(eventType, fn) {
    return this.eventBus.subscribe(eventType, fn);
  }

  destory() {
    this.dtableStore = null;
    this.eventBus = null;
  }

  getTableByName(name) {
    return TableUtils.getTableByName(this.dtableStore.value.tables, name);
  }

  getColumnByName(table, name) {
    return table.columns.find(column => column.name === name);
  }

  getRowById(table, rowId) {
    return table.Id2Row[rowId];
  }

  appendRow(table, rowData) {
    let tables = this.dtableStore.value.tables;
    let tableIndex = tables.findIndex(t => t._id === table._id);
    if (tableIndex === -1) {
      return;
    }
    let newRowData = RowUtils.convertRowBack(rowData, table);
    let rows = table.rows;
    let lastRow = rows.length === 0 ? null : rows[rows.length - 1];
    let rowId = lastRow ? lastRow._id : '';
    this.dtableStore.insertRow(tableIndex, rowId, 'insert_below', newRowData);
  }

  modifyRow(table, row, updated) {
    let tables = this.dtableStore.value.tables;
    let tableIndex = tables.findIndex(t => t._id === table._id);
    if (tableIndex === -1) {
      return;
    }
    let newUpdated = RowUtils.convertRowBack(updated, table);
    this.dtableStore.modifyRow(tableIndex, row._id, newUpdated, null);
  }

  forEachRow(tableName, viewName, callback) {
    let value = this.dtableStore.value;
    let table = TableUtils.getTableByName(value.tables, tableName);
    if (!table) {
      debug(`table ${tableName} does not exist.`);
      return;
    }
    let view = Views.getViewByName(table.views, viewName);
    if (!view) {
      debug(`view ${viewName} does not exist.`);
      return;
    }
    const rows = Views.getViewRows(view, table);

    const formulaColumns = Views.getAllFormulaColumns(Views.getColumns(view, table));
    let formulaResults = {};
    if (formulaColumns && formulaColumns.length > 0) {
      Views.updateFormulaRows(view, table, formulaColumns, rows);
      formulaResults = Views.getFormulaRows(view);
    }

    rows.forEach((row) => {
      let newRow = RowUtils.convertRow(row, value, table, view, formulaResults);
      callback(newRow);
    });
  }

  uploadFile(filePath, callback) {
    this.dtableWebAPI.getFileUploadLink().then(res => {
      let uploadLink = res.data.upload_link + '?ret-json=1';
      let parentPath = res.data.parent_path;
      let relativePath = 'files';
      let formData = new FormData();
      formData.append('parent_dir', parentPath);
      formData.append('relative_path', relativePath);
      formData.append('file', fs.createReadStream(filePath));
      formData.getLength((err, length) => {
        if (err) {
          callback(err);
        } else {
          let headers = Object.assign({'Content-Length': length}, formData.getHeaders());
          axios.post(uploadLink, formData, { headers: headers}).then(res => {
            // add file url
            let fileInfo = res.data[0];
            let { server, workspaceID } = this.config;
            let url = server + '/workspace/' + workspaceID + parentPath + '/' + relativePath + '/' + encodeURIComponent(fileInfo.name);
            fileInfo.url = url;
            callback(false, fileInfo);
          }).catch(err => {
            callback(err);
          });
        }
      });
    }).catch(err => {
      callback(err);
    });
  }

}

export default DTable;