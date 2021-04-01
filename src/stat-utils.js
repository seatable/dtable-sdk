import { Views, 
  TableUtils, 
  getDateByGranularity, 
  getValidOptionIds,
  getValidCollaborators, 
  isNumber,
  getFormulaDisplayString,
  getPrecisionNumber, CellType,
  STATISTICS_COUNT_TYPE, 
  FORMULA_RESULT_TYPE, 
  sortText, sortNumber, 
  sortDate, 
  sortSingleSelect, 
  sortFormula,
} from 'dtable-store';

class StatUtils {

  static getStatisticRows(table, view, value) {
    if (Views.isFilterView(view, table.columns)) {
      return TableUtils.getRowsByIds(
        table,
        Views.getRowIds(view, table, value)
      );
    }
    return table.rows;
  }

  static isValidRow(row, formulaRow, linkRow, columnType, columnKey, includeEmpty) {
    if (includeEmpty) return true;
    let cellValue;
    if (columnType === CellType.FORMULA) {
      cellValue = formulaRow ? formulaRow[columnKey] : null;
    } else if (columnType === CellType.GEOLOCATION) {
      cellValue = row[columnKey] ? row[columnKey].province : null;
    } else if (columnType === CellType.LINK) {
      cellValue = linkRow ? linkRow[columnKey] : null;
    } else {
      cellValue = row[columnKey];
    }

    return cellValue || cellValue === 0;
  }

  static getGroupLabel(
    row,
    formulaRow,
    linkRow,
    column,
    dateGranularity,
    geoGranularity,
    value
  ) {
    let { type, key, data } = column;
    let cellValue = row[key];
    switch (type) {
      case CellType.TEXT: {
        return cellValue || null;
      }
      case CellType.NUMBER: {
        if (!cellValue && cellValue !== 0) {
          return null;
        }
        return getPrecisionNumber(cellValue, data);
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
        return getDateByGranularity(cellValue, dateGranularity);
      }
      case CellType.MULTIPLE_SELECT: {
        let options = data && data.options;
        return getValidOptionIds(options, cellValue);
      }
      case CellType.COLLABORATOR: {
        return getValidCollaborators(cellValue);
      }
      case CellType.CREATOR:
      case CellType.LAST_MODIFIER: {
        return cellValue ? cellValue : null;
      }
      case CellType.FORMULA: {
        if (!formulaRow) return "";
        let formulaCellValue = formulaRow[key];
        let { result_type } = data || {};
        if (result_type === FORMULA_RESULT_TYPE.COLUMN) {
          return (
            getFormulaDisplayString(formulaCellValue, data, {
              tables: value.tables
            }) || null
          );
        } else if (result_type === FORMULA_RESULT_TYPE.NUMBER) {
          return getPrecisionNumber(formulaCellValue, data);
        }
        return formulaCellValue ? formulaCellValue + "" : null;
      }
      case CellType.GEOLOCATION: {
        return row[column.key] ? row[column.key][geoGranularity] : null;
      }
      case CellType.LINK: {
        if (!linkRow) return null;
        let linkCellValue = linkRow[key];
        return linkCellValue || [];
      }
      default: {
        return null;
      }
    }
  }

  static getTotal(
    summary_column_key,
    summary_column_type,
    summary_type,
    summary_method,
    rows = [],
    formula_rows = {}
  ) {
    let rowsLength = rows.length;
    let total;
    if (summary_type === STATISTICS_COUNT_TYPE.COUNT) {
      total = rowsLength;
    } else if (summary_type === STATISTICS_COUNT_TYPE.ADVANCED) {
      switch (summary_method) {
        case "Sum":
        case "Mean": {
          let sum = 0;
          let validNumbersCount = 0;
          rows.forEach(r => {
            let num;
            if (summary_column_type === CellType.FORMULA) {
              let formulaRow = formula_rows[r._id] || {};
              num = formulaRow[summary_column_key];
            } else {
              num = r[summary_column_key];
            }
            if (isNumber(num)) {
              validNumbersCount++;
              sum += num;
            }
          });
          if (summary_method === "Sum") {
            total = Number.parseFloat(sum.toFixed(8));
          } else if (summary_method === "Mean") {
            total =
              validNumbersCount === 0
                ? 0
                : Number.parseFloat((sum / validNumbersCount).toFixed(8));
          }
          break;
        }
        case "Max":
        case "Min": {
          if (rowsLength > 0) {
            let result = rows.reduce((current, next) => {
              let currentValue, nextValue;
              if (summary_column_type === CellType.FORMULA) {
                let currentFormulaRow = formula_rows[current._id] || {};
                let nextFormulaRow = formula_rows[next._id] || {};
                currentValue = currentFormulaRow[summary_column_key];
                nextValue = nextFormulaRow[summary_column_key];
              } else {
                currentValue = current[summary_column_key];
                nextValue = next[summary_column_key];
              }
              if (!nextValue && nextValue !== 0) {
                return current;
              }
              let isNextGreater = currentValue < nextValue;
              if (summary_method === "Min") {
                return isNextGreater ? current : next;
              } else {
                return isNextGreater ? next : current;
              }
            });
            if (summary_column_type === CellType.FORMULA) {
              let formulaRow = formula_rows[result._id];
              if (formulaRow) {
                total = formulaRow[summary_column_key];
              } else {
                total = null;
              }
            } else {
              total = result[summary_column_key];
            }
          }
          break;
        }
        default: {
          break;
        }
      }
    }
    return total || 0;
  }

  static sortStatistics(statistics, column, sort_key) {
    let { type: column_type, data } = column;
    const sortableColum = [
      CellType.TEXT,
      CellType.NUMBER,
      CellType.DATE,
      CellType.SINGLE_SELECT,
      CellType.FORMULA,
      CellType.MTIME,
      CellType.MTIME
    ];
    let sortType = "up";
    statistics.sort((currResult, nextResult) => {
      let { [sort_key]: current } = currResult;
      let { [sort_key]: next } = nextResult;
      if (!current && current !== 0) {
        return -1;
      }
      if (!next && next !== 0) {
        return 1;
      }
      if (sortableColum.includes(column_type)) {
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
            return sortSingleSelect(current, next, sortType, column);
          }
          case CellType.FORMULA: {
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
            return sortFormula(result_type, current, next, sortType);
          }
          default: {
            return sortText(current, next, sortType);
          }
        }
      }
    });
  }

  static isArrayCellValue(columnType) {
    return [
      CellType.MULTIPLE_SELECT,
      CellType.COLLABORATOR,
      CellType.LINK
    ].includes(columnType);
  }
}

export default StatUtils;