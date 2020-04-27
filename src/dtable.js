import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { DTableStore, Views, TableUtils, RowUtils, CellType } from 'dtable-store';
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
      const { app_name, access_token, dtable_uuid, dtable_server, dtable_socket } = res.data;
      this.config.appName = app_name;
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

  initInBrowser(dtableStore) {
    // init tool object
    this.dtableStore = dtableStore;
    this.eventBus = this.dtableStore.eventBus;

    this.config = {};
    this.dtableServerAPI = null;

  }

  async syncWithServer() {
    await this.dtableStore.loadFromServer();
    await this.dtableStore.loadRelatedUsers();
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

  getRelatedUsers() {
    return this.dtableStore.collaborators;
  }

  getActiveTable() {
    let tables = this.getTables();
    return this.dtableStore.currentTable || tables[0];
  }

  getTables() {
    return this.dtableStore.value.tables;
  }

  getTableByName(name) {
    let tables = this.getTables();
    return TableUtils.getTableByName(tables, name);
  }

  getActiveView() {
    let activeTable = this.getActiveTable();
    let views = this.getViews(activeTable);
    let active_index = this.dtableStore.view_index;
    return views[active_index] || views[0];
  }

  getViews(table) {
    return table.views;
  }

  getViewByName(table, name) {
    return table.views.find(view => view.name === name);
  }

  getColumns(table) {
    return table.columns;
  }

  getShownColumns(table, view) {
    let hidden_columns = view.hidden_columns;
    let shownColumns = table.columns.filter(column => {
      return hidden_columns.indexOf(column.key) === -1;
    });
    return shownColumns;
  }

  getColumnByName(table, name) {
    return table.columns.find(column => column.name === name);
  }

  getColumnsByType(table, type) {
    return this.getColumns(table).filter((item) => item.type === type);
  }

  getCellType() {
    return CellType;
  }

  getRowById(table, rowId) {
    return table.id_row_map[rowId];
  }

  appendRow(table, rowData, view = null) {
    let tables = this.getTables();
    let tableIndex = tables.findIndex(t => t._id === table._id);
    if (tableIndex === -1) {
      return;
    }
    let newRowData = RowUtils.convertRowBack(rowData, table);
    const rows = view ? View.getViewRows(view, table) : table.rows;
    const lastRow = row.length === 0 ? null : rows[rows.length - 1];
    let rowId = lastRow ? lastRow._id : '';
    this.dtableStore.insertRow(tableIndex, rowId, 'insert_below', newRowData);
  }

  modifyRow(table, row, updated) {
    let tables = this.getTables();
    let tableIndex = tables.findIndex(t => t._id === table._id);
    if (tableIndex === -1) {
      return;
    }
    let newUpdated = RowUtils.convertRowBack(updated, table);
    this.dtableStore.modifyRow(tableIndex, row._id, newUpdated, null);
  }

  forEachRow(tableName, viewName, callback) {
    let value = this.dtableStore.value;
    let tables = this.getTables();
    let table = TableUtils.getTableByName(tables, tableName);
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

  getViewRows(view, table) {
    return Views.getViewRows(view, table);
  }

  getInsertedRowInitData(view, table, row_id) {
    let row_data = {};
    if (!Views.isDefaultView(view)) {
      row_data = Views.getRowDataUsedInFilters(view, table, row_id);
    }
    return row_data;
  }

  getRowCommentCount(rowID) {
    return this.dtableServerAPI.getRowCommentsCount(rowID);
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

  getPluginSettings(plugin_name) {
    let plugin_settings = this.dtableStore.value.plugin_settings || {};
    return plugin_settings[plugin_name] || null;
  }

  updatePluginSettings(plugin_name, plugin_settings) {
    this.dtableStore.updatePluginSettings(plugin_name, plugin_settings);
  }

  deletePluginSettings(plugin_name) {
    this.dtableStore.deletePluginSettings(plugin_name);
  }

}

export { Chart, generatorStatId } from 'dtable-store'

export default DTable;