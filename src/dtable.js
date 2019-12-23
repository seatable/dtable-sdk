import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import DtableStore from '@seafile/dtable/lib/store/dtable-store';
import DTableServerAPI from './dtable-server-api';
import DTableWebAPI from './dtable-web-api';
import { convertRow, convertRowBack } from './row-utils';

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
      this.config.dtableServer = dtable_server.replace(/\/+$/, "") + "/";
      this.config.dtableSocket = dtable_socket.replace(/\/+$/, "") + "/";
      this.dtableServerAPI = new DTableServerAPI(this.config);
      this.dtableStore = new DtableStore(this.config);
      this.eventBus = this.dtableStore.eventBus;
    } catch(err) { 
      console.log(err);
      return;
    };
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
        return;
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
    return this.dtableStore.getTableByName(name);
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
    let newRowData = convertRowBack(table, rowData);
    let lastRow = table.rows[table.rows.length - 1];
    this.dtableStore.insertRow(tableIndex, lastRow._id, 'insert_below', newRowData);
  }

  modifyRow(table, row, updated) {
    let tables = this.dtableStore.value.tables;
    let tableIndex = tables.findIndex(t => t._id === table._id);
    if (tableIndex === -1) {
      return;
    }
    let newUpdated = convertRowBack(table, updated);
    this.dtableStore.modifyRow(tableIndex, row._id, newUpdated, null);
  }

  forEachRow(tableName, viewName, callback) {
    let table = this.dtableStore.getTableByName(tableName);
    if (!table) return;
    const rows = this.dtableStore.getViewRowsByNames(tableName, viewName);
    const formulaColumns = this.dtableStore.getAllFormulaColumns(table);
    const formulaResults = formulaColumns && this.dtableStore.getTableFormulaResults(table, formulaColumns, rows);
    rows.forEach((row) => {
      let newRow = convertRow(table, row, this.dtableStore, formulaResults);
      callback(newRow);
    });
  }

  uploadFile(filePath, callback) {
    this.dtableWebAPI.getFileUploadLink().then(res => {
      let uploadLink = res.data.upload_link + '?ret-json=1';
      let parentPath = res.data.parent_path;
      let relativePath = 'files';
      let formData = new FormData();
      formData.append("parent_dir", parentPath);
      formData.append("relative_path", relativePath);
      formData.append("file", fs.createReadStream(filePath));
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
            callback(err)
          })
        }
      })
    }).catch(err => {
      callback(err)
    });
  }

}

export default DTable;