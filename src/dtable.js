import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { DTableStore,
  Views,
  TableUtils,
  RowUtils,
  CellType,
  Chart,
  generatorStatId,
  SELECT_OPTION_COLORS,
  HIGHLIGHT_COLORS,
  COLUMNS_ICON_CONFIG,
  getCellValueDisplayString,
  getNumberDisplayString,
  getGeolocationDisplayString,
  getDurationDisplayString,
  getCollaboratorsName,
  getDateDisplayString,
  getLinkDisplayString,
  FORMULA_RESULT_TYPE,
  TABLE_PERMISSION_TYPE,
} from 'dtable-store';
import Debug from 'debug';
import DTableServerAPI from './dtable-server-api';
import DTableWebAPI from './dtable-web-api';
import Utils from './utils';

const debug = Debug('dtable:sdk');

const ACCESS_TOKEN_INTERVAL_TIME = (3 * 24 * 60 - 1) * 60 * 1000;

class DTable {

  constructor() {
    this.dtableStore = null;
    this.eventBus = null;
    this.dtableWebAPI = null;
    this.dtableServerAPI = null;
    this.utils = new Utils();
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

  importDataIntoNewTable(table_name, columns, rows) {
    const tables = this.dtableStore.value.tables;
    if (tables.length >= 200) throw new Error('The_number_of_tables_exceeds_200_limit');
    if (!table_name) throw new Error('Table_name_is_required');
    if (!columns) throw new Error('Columns_is_required');
    if (!Array.isArray(columns)) throw new Error('Columns_must_be_array');
    if (columns.length === 0) throw new Error('The_number_of_columns_must_be_more_than_0');
    if (columns.length >= 500) throw new Error('The_number_of_columns_in_the_current_table_exceeds_the_limit');
    if (rows && !Array.isArray(rows)) throw new Error('Rows_must_be_array');
    return this.dtableStore.importDataIntoNewTable(table_name, columns, rows);
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

  getNonArchiveViews(table) {
    const allViews = this.getViews(table);
    return allViews.filter(view => !Views.isArchiveView(view));
  }

  getViewByName(table, view_name) {
    return Views.getViewByName(table.views, view_name);
  }

  getViewById(table, view_id) {
    return Views.getViewById(table.views, view_id);
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

  getColumnByKey(table, key) {
    return table.columns.find(column => column.key === key);
  }

  getColumnsByType(table, type) {
    return this.getColumns(table).filter((item) => item.type === type);
  }

  getCellType() {
    return CellType;
  }

  getFormulaResultType() {
    return FORMULA_RESULT_TYPE;
  }

  getColumnIconConfig() {
    return COLUMNS_ICON_CONFIG;
  }

  getRowById(table, rowId) {
    return table.id_row_map[rowId];
  }

  appendRow(table, rowData, view, { collaborators } = {}) {
    let tables = this.getTables();
    let tableIndex = tables.findIndex(t => t._id === table._id);
    if (tableIndex === -1) {
      return;
    }
    let newRowData = RowUtils.convertRowBack(rowData, table, collaborators);
    const rows = view ? this.getViewRows(view, table) : table.rows;
    const lastRow = rows.length === 0 ? null : rows[rows.length - 1];
    let rowId = lastRow ? lastRow._id : '';
    return this.dtableStore.insertRow(tableIndex, rowId, 'insert_below', newRowData);
  }

  deleteRowById(table, row_id) {
    this.dtableStore.deleteRowById(table._id, row_id);
  }

  deleteRowsByIds(table, row_ids) {
    const tables = this.getTables();
    const tableIndex = tables.findIndex(t => t._id === table._id);
    const deleted_rows = this.getRowsByID(table._id, row_ids);
    const upper_row_ids = [];
    this.dtableStore.deleteRows(tableIndex, row_ids, deleted_rows, upper_row_ids);
  }

  modifyRow(table, row, updated) {
    let tables = this.getTables();
    let tableIndex = tables.findIndex(t => t._id === table._id);
    if (tableIndex === -1) {
      return;
    }
    let newUpdated = RowUtils.convertRowBack(updated, table);
    let oldData = {};
    Object.keys(newUpdated).forEach(key => {
      oldData[key] = row[key];
    });
    if (JSON.stringify(oldData) === JSON.stringify(newUpdated)) {
      return;
    }
    this.dtableStore.modifyRow(tableIndex, row._id, newUpdated, null);
  }

  forEachRow(tableName, viewName, callback, { username, userId } = {}) {
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
    const rows = this.getViewRows(view, table, username, userId);

    const formulaColumns = Views.getAllFormulaColumns(Views.getColumns(view, table));
    let formulaResults = {};
    if (formulaColumns && formulaColumns.length > 0) {
      formulaResults = Views.getTableFormulaResults(table, rows, value, formulaColumns);
    }

    rows.forEach((row) => {
      let newRow = RowUtils.convertRow(row, value, table, view, formulaResults);
      callback(newRow);
    });
  }

  getViewRows(view, table, username = null, userId = null) {
    return Views.getViewRows(view, table, this.dtableStore.value, username, userId);
  }

  getInsertedRowInitData(view, table, row_id) {
    let row_data = {};
    const value = this.dtableStore.value;
    if (!Views.isDefaultView(view, table.columns, value)) {
      // originRowData: {[column.key]: cell_value}, exclude columns: auto_number
      // row_data, which is converted from originRowData: {[column.name]: converted_cell_value}

      let originRowData = Views.getRowDataUsedInFilters(view, table, row_id, value);
      row_data = RowUtils.convertRow(originRowData, value, table, view);
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

  generatorStatId(statItems) {
    return generatorStatId(statItems);
  }

  calculateChart(statItem) {
    return Chart.calculateChart(statItem, this.dtableStore.value);
  }

  calculateGeolocationBasicChart(statItem) {
    return Chart.calculateGeolocationBasicChart(statItem, this.dtableStore.value);
  };

  getTableFormulaResults(table, rows) {
    const formulaColumns = Views.getAllFormulaColumns(table.columns);
    return Views.getTableFormulaResults(table, rows, this.dtableStore.value, formulaColumns);
  }

  getViewRowsColor(rows, view, table) {
    return Views.getRowsColor(rows, view, table, this.dtableStore.value);
  }

  getOptionColors() {
    return SELECT_OPTION_COLORS;
  }

  getHighlightColors() {
    return HIGHLIGHT_COLORS;
  }

  getLinkCellValue(linkId, table1Id, table2Id, rowId) {
    return this.dtableStore.getLinkCellValue(linkId, table1Id, table2Id, rowId);
  }

  getTableLinkRows(rows, table) {
    return RowUtils.getTableLinkRows(rows, table, this.dtableStore.value);
  }
  
  getRowsByID(tableId, rowIds) {
    return this.dtableStore.getRowsByID(tableId, rowIds);
  }

  getTableById(table_id) {
    let tables = this.getTables();
    return TableUtils.getTableById(tables, table_id);
  }

  addTable(tableName) {
    this.dtableStore.insertTable(tableName);
  }

  deleteTable(tableName) {
    const tables = this.getTables();
    const index = tables.findIndex((table) => {
      return table.name === tableName
    });
    this.dtableStore.deleteTable(index);
  }

  renameTable(previousName, tableName) {
    const tables = this.getTables();
    const index = tables.findIndex((table) => {
      return table.name === previousName
    });
    this.dtableStore.renameTable(index, tableName);
  }

  addView(tableName, viewName) {
    const viewData = { name: viewName, type: 'table'};
    const tables = this.getTables();
    const index = tables.findIndex((table) => {
      return table.name === tableName
    });
    this.dtableStore.insertView(index, viewData);
  }

  renameView(tableName, previousName, viewName) {
    const tables = this.getTables();
    const index = tables.findIndex((table) => {
      return table.name === tableName
    });

    const selectedTable = tables[index];

    const viewIndex = selectedTable.views.findIndex((view) => {
      return view.name === previousName;
    });
    this.dtableStore.renameView(index, viewIndex, viewName);
  }

  deleteView(tableName, viewName) {
    const tables = this.getTables();
    const tableIndex = tables.findIndex((table) => {
      return table.name === tableName
    });
    const selectedTable = tables[tableIndex];
    const viewIndex = selectedTable.views.findIndex((view) => {
      return view.name === viewName;
    });
    this.dtableStore.deleteView(tableIndex, viewIndex);
  }

  addRow(tableName, rowData, viewName = null) {
    const table = this.getTableByName(tableName);
    let view = null;
    if (viewName) {
      view = this.getViewByName(table, viewName);
    }
    return this.appendRow(table, rowData, view);
  }

  getGroupRows(view, table) {
    const value = this.dtableStore.value;
    return Views.getGroupedRows(view, table, value);
  }

  isGroupView(view, columns) {
    return Views.isGroupView(view, columns);
  }

  getCellValueDisplayString(row, type, key, {tables = [], formulaRows = {}, data, collaborators = []}) {
    return getCellValueDisplayString(row, type, key, {tables, formulaRows, data, collaborators});
  }

  getLinkDisplayString(rowIds, linkedTable, displayColumnKey = '0000') {
    return getLinkDisplayString(rowIds, linkedTable, displayColumnKey);
  }

  getNumberDisplayString(value, columnData) {
    return getNumberDisplayString(value, columnData);
  }

  getGeolocationDisplayString(value, columnData) {
    return getGeolocationDisplayString(value, columnData);
  }

  getDurationDisplayString(value, columnData) {
    return getDurationDisplayString(value, columnData);
  }
  
  getDateDisplayString(value, columnData) {
    const { format } = columnData;
    return getDateDisplayString(value, format);
  }

  getCollaboratorsName(collaborators, value) {
    return getCollaboratorsName(collaborators, value);
  }

  modifyColumnData(table, columnName, columnData) {
    const tables = this.getTables();
    let tableIndex = tables.findIndex(t => t._id === table._id);
    if (tableIndex === -1) {
      return;
    }
    const updateColumn = this.getColumnByName(table, columnName);
    if (!updateColumn) {
      return;
    }
    this.dtableStore.setColumnData(tableIndex, updateColumn.key, columnData);
  }

  moveGroupRows(table, targetIds, movePosition, movedRows, upperRowIds, updated, oldRows, groupbyColumn) {
    const tables = this.getTables();
    let tableIndex = tables.findIndex(t => t._id === table._id);
    if (tableIndex === -1) {
      return;
    }
    this.dtableStore.moveGroupRows(tableIndex, targetIds, movePosition, movedRows, upperRowIds, updated, oldRows, groupbyColumn)
  }

  sqlQuery(sql) {
    return this.dtableStore.dtableAPI.sqlQuery(sql);
  }

  getTablePermissionType() {
    return TABLE_PERMISSION_TYPE;
  }

}

export default DTable;
