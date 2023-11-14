import {
  Views, 
  DateUtils,
  FORMULA_RESULT_TYPE,
  getPrecisionNumber,
  getFormulaDisplayString,
  getGeolocationDisplayString,
  getDateDisplayString,
  getNumberDisplayString,
  getCellValueDisplayString,
} from 'dtable-store';
import {
  isNumber,
  CellType,
  sortText,
  sortNumber,
  sortDate,
  sortSingleSelect,
} from 'dtable-utils';

const SUPPORT_SORT_COLUMNS = [
  CellType.TEXT, 
  CellType.NUMBER, 
  CellType.DATE, 
  CellType.SINGLE_SELECT,
  CellType.FORMULA, 
  CellType.LINK_FORMULA, 
  CellType.CTIME, 
  CellType.MTIME, 
  CellType.RATE
];

class StatUtils {

  static getStatisticRows(table, view, value, username, userId) {
    return Views.getViewRows(view, table, value, username, userId);
  }

  static getNumberDisplayString(value, columnData) {
    return getNumberDisplayString(value, columnData);
  }

  static getTableFormulaResults(table, rows, value) {
    return Views.getTableFormulaResults(table, rows, value);
  }

  static getCellValueDisplayString(row, type, key, {tables = [], formulaRows = {}, data, collaborators = []}) {
    return getCellValueDisplayString(row, type, key, {tables, formulaRows, data, collaborators});
  }

  static getFormulaDisplayString(cellValue, columnData) {
    return getFormulaDisplayString(cellValue, columnData);
  }

  static getGroupLabel(
    cellValue,
    formulaRow,
    column,
    dateGranularity,
    geoGranularity,
    value
  ) {
    let { type, key, data } = column;
    switch (type) {
      case CellType.TEXT: {
        return cellValue || null;
      }
      case CellType.NUMBER: {
        if (!cellValue && cellValue !== 0) {
          return null;
        }
        const number = getPrecisionNumber(cellValue, data);
        let valueNumber = parseFloat(number);
        return isNumber(valueNumber) ? getNumberDisplayString(valueNumber, column.data) : valueNumber;
      }
      case CellType.SINGLE_SELECT: {
        let isInvalidValue =
          data && data.options.findIndex(opt => opt.id === cellValue) < 0;
        if (isInvalidValue) {
          return null;
        }
        return cellValue;
      }
      case CellType.DATE:
      case CellType.CTIME:
      case CellType.MTIME: {
        if (!dateGranularity) {
          return getDateDisplayString(cellValue);
        }
        return DateUtils.getDateByGranularity(cellValue, dateGranularity);
      }
      case CellType.MULTIPLE_SELECT: {
        let options = data && data.options;
        if (!Array.isArray(cellValue)) {
          return [];
        }
        return cellValue.filter(id => options.findIndex(o => o.id === id) > -1);
      }
      case CellType.COLLABORATOR: {
        return getValidCollaborators(value.collaborators, cellValue);
      }
      case CellType.CREATOR:
      case CellType.LAST_MODIFIER: {
        return cellValue ? cellValue : null;
      }
      case CellType.LINK_FORMULA:
      case CellType.FORMULA: {
        if (!formulaRow) return '';
        let formulaCellValue = formulaRow[key];
        let { result_type } = data || {};
        if (result_type === FORMULA_RESULT_TYPE.ARRAY) {
          return getFormulaDisplayString(formulaCellValue, data, {tables: value.tables}) || null;
        }
        if (result_type === FORMULA_RESULT_TYPE.NUMBER) {
          return getPrecisionNumber(formulaCellValue, data);
        }
        return formulaCellValue ? formulaCellValue + '' : null;
      }
      case CellType.GEOLOCATION: {
        const { geo_format } = data || {};
        if (geo_format === 'country_region' || geo_format === 'lng_lat' || !geoGranularity) {
          return getGeolocationDisplayString(cellValue, data);
        }
        return cellValue ? cellValue[geoGranularity] : null;
      }
      case CellType.LINK: {
        const linkCellValue = formulaRow && formulaRow[key];
        if (!Array.isArray(linkCellValue)) {
          return [];
        }
        return linkCellValue.map(linkVal => linkVal.display_value);
      }
      case CellType.CHECKBOX: {
        return String(!!cellValue);
      }
      case CellType.RATE: {
        if (!cellValue) return null;
        return cellValue + '';
      }
      default: {
        return null;
      }
    }
  }

  static sortStatistics(statistics, column, sort_key) {
    let { type: column_type, data } = column;
    let sortType = 'up';
    let option_id_index_map = {};
    if (column_type === CellType.SINGLE_SELECT) {
      const { options } = data || {};
      Array.isArray(options) && options.forEach((option, index) => {
        option_id_index_map[option.id] = index;
      });
    }
    statistics.sort((currResult, nextResult) => {
      let { [sort_key]: current } = currResult;
      let { [sort_key]: next } = nextResult;
      if (!current && current !== 0) {
        return -1;
      }
      if (!next && next !== 0) {
        return 1;
      }
      if (SUPPORT_SORT_COLUMNS.includes(column_type)) {
        switch (column_type) {
          case CellType.NUMBER: {
            if (current) {
              current = current - 0;
            }
            if (next) {
              next = next - 0;
            }
            return sortNumber(current, next, sortType);
          }
          case CellType.DATE:
          case CellType.CTIME:
          case CellType.MTIME: {
            return sortDate(current, next, sortType);
          }
          case CellType.SINGLE_SELECT:
          case CellType.MULTIPLE_SELECT: {
            return sortSingleSelect(current, next, {sort_type: sortType, option_id_index_map});
          }
          case CellType.FORMULA:
          case CellType.LINK_FORMULA: {
            let { result_type } = data || {};
            if (result_type === FORMULA_RESULT_TYPE.NUMBER) {
              if (current) {
                current = current - 0;
              }
              if (next) {
                next = next - 0;
              }
              return sortNumber(current, next, sortType);
            }
            return sortText(result_type, current, next, sortType);
          }
          default: {
            return sortText(current, next, sortType);
          }
        }
      }
    });
  }

}

const getValidCollaborators = (collaborators, emails) => {
  if (!Array.isArray(emails)) {
    return []
  }
  return emails.filter(e => collaborators.findIndex(c => c.email === e) > -1);
};

export default StatUtils;
