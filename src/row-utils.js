import Debug from 'debug';
import { LinksUtils } from 'dtable-store';
import getPreviewContent from './normalize-long-text-value';
const debug = Debug('dtable:sdk');

function getSelectOptionName(column, optionID) {
  let options = column.data && column.data.options;
  if (options && optionID) {
    let option = options && options.find(option => option.id === optionID);
    return option ? option.name : '';
  }
  return '';
}

function getRowsByID(tables, tableID, rowIds) {
  const table = tables.find(table => {
    return table._id === tableID;
  });
  if (!table) {
    return [];
  }
  return rowIds.map(row_id => {
    return table.id_row_map[row_id];
  }).filter(row => {
    return row;
  });
}

function getLinkCellValue(links, table1ID, table2ID, rowID) {
  if (!links || !table1ID || !table2ID || !rowID) {
    return [];
  }
  let linkBetween2Tables = LinksUtils.getLinkByTableIds(links, table1ID, table2ID);
  if (!linkBetween2Tables) {
    return [];
  }
  const linkMap = linkBetween2Tables.table1_id === table1ID ? linkBetween2Tables.table1_table2_map : linkBetween2Tables.table2_table1_map;
  if (!linkMap[rowID]) {
    return [];
  }
  return linkMap[rowID];
}

function convertRow(value, table, row, formulaResults) {
  var result = {};
  result['_id'] = row._id;
  table.columns.forEach((column) => {
    switch (column.type) {
      case 'single-select':
        if (!column.data) {
          debug('No options found');
          break;
        }
        result[column.name] = getSelectOptionName(column, row[column.key]);
        break;
      case 'multiple-select':
        if (!column.data) {
          debug('No options found');
          break;
        }
        let optionNames = [];
        const optionIds = row[column.key];
        if (!Array.isArray(optionIds)) {
          result[column.name] = '';
          break;
        }
        for (let i = 0; i < optionIds.length; i++) {
          const optionName = getSelectOptionName(column, optionIds[i]);
          if (optionName) {
            optionNames.push(optionName);
          }
        }
        result[column.name] = optionNames;
        break;
      case 'long-text':
        const richValue = row[column.key];
        result[column.name] = richValue ? richValue.text : '';
        break;
      case 'link':
        if (!column.data) {
          debug('No links found');
        } else {
          result[column.name] = convertLinkRow(value, table, column, row._id);
        }
        break;
      case 'formula':
        if (!column.data || !formulaResults) {
          debug('No formula found');
        } else {
          const rowID = row._id;
          const columnKey = column.key;
          result[column.name] = formulaResults[rowID] ? formulaResults[rowID][columnKey] : null;
        }
        break;
      default:
        // simple-text/number/collaborator/check/file/date/image
        result[column.name] = row[column.key];
    }
  });
  return result;
}

function convertRowBack(table, row) {
  var result = {};

  for (const key in row) {
    if (key == '_id') {
      result['_id'] = row[key];
    } else {
      let column = table.columns.find(column => column.name === key);
      if (!column) {
        continue;
      }
      switch (column.type) {
        case 'single-select':
          if (column.data) {
            const option = column.data.options.find(item => { return item.name === row[key];});
            if (option) {
              result[column.key] = option.id;
            } else {
              debug(`${row[key]} was not found, please create a new option`);
            }
          } else {
            debug(`${row[key]} was not found, please create a new option`);
          }
          break;
        case 'multiple-select':
          if (!column.data) {
            debug('No options found, please create a new option');
            break;
          }
          const { options } = column.data;
          const optionNames = row[key];
          let optionIds = [];
          for (let i = 0; i < optionNames.length; i++) {
            const option = options.find(item => {return item.name === optionNames[i];});
            if (option) {
              optionIds.push(option.id);
            } else {
              debug(`${optionNames[i]} was not found, please create a new option`);
            }
          }
          result[column.key] = optionIds;
          break;
        case 'long-text':
          const text = row[key];
          const { preview, images, links } = getPreviewContent(text);
          const value = { text, preview, images, links };
          result[column.key] = value;
          break;
        // don't support link column and formula column convertRowBack
        case 'link':
          break;
        case 'formula':
          break;
        default:
          // simple-text/number/collaborator/check/file/date/image
          result[column.key] = row[key];
      }
    }
  }
  return result;
}

function convertLinkRow(value, table, column, rowId) {
  const { tables, links } = value;
  const { table_id, other_table_id } = column.data;
  const tableID = table._id;
  const otherTableID = tableID === table_id ? other_table_id : table_id;
  const otherTableRowIDs = getLinkCellValue(tables, tableID, otherTableID, rowId);
  const otherTableRows = getRowsByID(links, otherTableID, otherTableRowIDs);
  return otherTableRows.map(row => { return row['0000']; });
}

export { convertRow, convertRowBack };