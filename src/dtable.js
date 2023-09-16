import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import {
  DTableStore,
  Views,
  TableUtils,
  RowUtils,
  CellType,
  generatorStatId,
  SELECT_OPTION_COLORS,
  HIGHLIGHT_COLORS,
  COLUMNS_ICON_CONFIG,
  getCellValueDisplayString,
  getNumberDisplayString,
  getOptionName,
  getMultipleOptionName,
  getLongtextDisplayString,
  getGeolocationDisplayString,
  getDurationDisplayString,
  getCollaboratorsName,
  getDateDisplayString,
  getLinkDisplayString,
  FORMULA_RESULT_TYPE,
  TABLE_PERMISSION_TYPE,
  sortFormula,
  getCellValueStringResult,
  getFormulaDisplayString,
  LinksUtils,
  formatTextToDate,
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

  getTables() {
    return this.dtableStore.value.tables;
  }

  getActiveTable() {
    let tables = this.getTables();
    return this.dtableStore.currentTable || tables[0];
  }

  getTableByName(name) {
    let tables = this.getTables();
    return TableUtils.getTableByName(tables, name);
  }

  getTableById(table_id) {
    let tables = this.getTables();
    return TableUtils.getTableById(tables, table_id);
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

  addView(tableName, viewName) {
    const viewData = { name: viewName, type: 'table'};
    const tables = this.getTables();
    const index = tables.findIndex((table) => {
      return table.name === tableName
    });
    this.dtableStore.insertView(index, viewData);
  }

  deleteView(tableName, viewName) {
    const tables = this.getTables();
    const tableIndex = tables.findIndex((table) => {
      return table.name === tableName
    });
    const selectedTable = tables[tableIndex];
    const view = Views.getViewByName(selectedTable.views, viewName);
    this.dtableStore.deleteView(tableIndex, view._id);
  }

  renameView(tableName, previousName, viewName) {
    const tables = this.getTables();
    const index = tables.findIndex((table) => {
      return table.name === tableName
    });

    const selectedTable = tables[index];
    const view = Views.getViewByName(selectedTable.views, previousName);
    this.dtableStore.renameView(index, view._id, viewName);
  }

  getViews(table) {
    return Views.getNonPrivateViews(table.views);
  }

  getNonArchiveViews(table) {
    const allViews = this.getViews(table);
    return allViews.filter(view => !Views.isArchiveView(view));
  }

  getActiveView() {
    let activeTable = this.getActiveTable();
    let views = this.getViews(activeTable);
    let active_id = this.dtableStore.view_id;
    return Views.getViewById(views, active_id) || views[0];
  }

  getViewByName(table, view_name) {
    return Views.getViewByName(table.views, view_name);
  }

  getViewById(table, view_id) {
    return Views.getViewById(table.views, view_id);
  }

  isGroupView(view, columns) {
    return Views.isGroupView(view, columns);
  }

  isDefaultView(view, columns) {
    return Views.isDefaultView(view, columns);
  }

  isFilterView(view, columns) {
    return Views.isFilterView(view, columns);
  }

  getColumns(table) {
    return table.columns;
  }

  getViewShownColumns(view, table) {
    return Views.getColumns(view, table);
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

  formatDate(value, format) {
    const REG_CHINESE_DATE_FORMAT = /(\d{4})年(\d{1,2})月(\d{1,2})日(\d{1,2})?[:：分]?(\d{1,2})?秒?$/;
    if (value.indexOf('年') > -1) {
      let newCopiedCellVal = value.replace(/\s*/g, '');
      if (!REG_CHINESE_DATE_FORMAT.test(newCopiedCellVal)) {
        return '';
      }
      return formatTextToDate(newCopiedCellVal.replace(REG_CHINESE_DATE_FORMAT, '$1-$2-$3 $4:$5'), format);
    }
    return formatTextToDate(value, format);
  }

  addRow(tableName, rowData, viewName = null) {
    const table = this.getTableByName(tableName);
    let view = null;
    if (viewName) {
      view = this.getViewByName(table, viewName);
    }
    return this.appendRow(table, rowData, view);
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
    this.dtableStore.deleteRowsByIds(table._id, row_ids);
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

  forEachRow(tableName, viewName, callback, { convertLinkID } = {}) {
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
    const rows = this.getViewRows(view, table);

    const formulaColumns = convertLinkID ? Views.getFormulaColumnsContainLinks(table) : Views.getAllFormulaColumns(Views.getColumns(view, table));
    let formulaResults = {};
    if (formulaColumns && formulaColumns.length > 0) {
      formulaResults = Views.getTableFormulaResults(table, rows, value, formulaColumns);
    }

    rows.forEach((row) => {
      let newRow = RowUtils.convertRow(row, value, table, view, formulaResults, convertLinkID);
      callback(newRow);
    });
  }

  getTableLinkRows(rows, table) {
    return RowUtils.getTableLinkRows(rows, table, this.dtableStore.value);
  }

  getViewRows(view, table) {
    const { username = null, userId = null } = this.dtableStore.dtableSettings;
    return Views.getViewRows(view, table, this.dtableStore.value, username, userId);
  }

  getGroupRows(view, table) {
    const value = this.dtableStore.value;
    return Views.getGroupedRows(view, table, value);
  }

  getInsertedRowInitData(view, table, row_id) {
    let row_data = {};
    const value = this.dtableStore.value;
    if (!Views.isDefaultView(view, table.columns)) {
      // originRowData: {[column.key]: cell_value}, exclude columns: auto_number
      // row_data, which is converted from originRowData: {[column.name]: converted_cell_value}

      let originRowData = Views.getRowDataUsedInFilters(view, table, row_id);
      row_data = RowUtils.convertRow(originRowData, value, table, view);
    }
    return row_data;
  }

  getRowsByID(tableId, rowIds) {
    return this.dtableStore.getRowsByID(tableId, rowIds);
  }

  getRowById(table, rowId) {
    return table.id_row_map[rowId];
  }

  moveGroupRows(table, targetIds, movePosition, movedRows, upperRowIds, updated, oldRows, groupbyColumn) {
    const tables = this.getTables();
    let tableIndex = tables.findIndex(t => t._id === table._id);
    if (tableIndex === -1) {
      return;
    }
    this.dtableStore.moveGroupRows(tableIndex, targetIds, movePosition, movedRows, upperRowIds, updated, oldRows, groupbyColumn)
  }

  getRowCommentCount(rowID) {
    return this.dtableServerAPI.getRowCommentsCount(rowID);
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

  getTableFormulaResults(table, rows) {
    const formulaColumns = Views.getFormulaColumnsContainLinks(table);
    return Views.getTableFormulaResults(table, rows, this.dtableStore.value, formulaColumns);
  }

  getViewRowsColor(rows, view, table) {
    const { colors } = Views.getRowsColor(rows, view, table, this.dtableStore.value) || {};
    return colors || {};
  }
  
  /**
   * @deprecated
   * @returns CellType
   */
  getCellType() {
    return CellType;
  }

  /**
   * @deprecated
   * @returns FORMULA_RESULT_TYPE
   */
  getFormulaResultType() {
    return FORMULA_RESULT_TYPE;
  }

  /**
   * @deprecated
   * @returns COLUMNS_ICON_CONFIG
   */
  getColumnIconConfig() {
    return COLUMNS_ICON_CONFIG;
  }

  /**
   * @deprecated
   * @returns SELECT_OPTION_COLORS
   */
  getOptionColors() {
    return SELECT_OPTION_COLORS;
  }

  /**
   * @deprecated
   * @returns HIGHLIGHT_COLORS
   */
  getHighlightColors() {
    return HIGHLIGHT_COLORS;
  }

  /**
   * @deprecated
   * @returns TABLE_PERMISSION_TYPE
   */
  getTablePermissionType() {
    return TABLE_PERMISSION_TYPE;
  }

  getLinkCellValue(linkId, table1Id, table2Id, rowId) {
    return this.dtableStore.getLinkCellValue(linkId, table1Id, table2Id, rowId);
  }

  addLink = (linkId, tableId, otherTableId, rowId, otherRowId) => {
    this.dtableStore.addLink(linkId, tableId, otherTableId, rowId, otherRowId);
  }

  removeLink = (linkId, tableId, otherTableId, rowId, otherRowId) => {
    this.dtableStore.removeLink(linkId, tableId, otherTableId, rowId, otherRowId);
  }

  getCellValueDisplayString(row, type, key, {tables = [], formulaRows = {}, data, collaborators = []}) {
    return getCellValueDisplayString(row, type, key, {tables, formulaRows, data, collaborators});
  }

  getCellValueStringResult(row, column, { formulaRows = {}, collaborators = [], isArchiveView = false } = {}) {
    return getCellValueStringResult(row, column, { formulaRows, collaborators, isArchiveView });
  }

  getFormulaDisplayString(cellValue, columnData, { tables = [] } = {}) {
    return getFormulaDisplayString(cellValue, columnData, { tables });
  }

  getLinkDisplayString(rowIds, linkedTable, displayColumnKey = '0000') {
    return getLinkDisplayString(rowIds, linkedTable, displayColumnKey);
  }

  getNumberDisplayString(value, columnData) {
    return getNumberDisplayString(value, columnData);
  }

  getOptionName(options, cellVal) {
    return getOptionName(options, cellVal);
  }

  getMultipleOptionName(options, cellVal) {
    return getMultipleOptionName(options, cellVal);
  }

  getLongtextDisplayString(cellVal) {
    return getLongtextDisplayString(cellVal);
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

  sqlQuery(sql) {
    return this.dtableStore.dtableAPI.sqlQuery(sql);
  }

  sortFormula(currCellVal, nextCellVal, sortType, { columnData, value }) {
    return sortFormula(currCellVal, nextCellVal, sortType, { columnData, value })
  }

  getLinkTableID(currentTableId, table_id, other_table_id) {
    return LinksUtils.getLinkTableID(currentTableId, table_id, other_table_id);
  }

  getLinkedTableID(currentTableId, table_id, other_table_id) {
    return LinksUtils.getLinkedTableID(currentTableId, table_id, other_table_id);
  }

  getScripts = () => {
    const { scripts } = this.dtableStore.value || { scripts: [] };
    return scripts;
  }

}

export default DTable;
