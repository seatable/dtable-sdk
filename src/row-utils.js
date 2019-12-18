import getPreviewContent from './normalize-long-text-value';
import Debug from 'debug';

const debug = Debug('dtable:sdk');

function convertRow(table, row) {
  var result = {};
  result['_id'] = row._id;
  table.columns.forEach((column) => {
      switch (column.type) {
        case 'file':
          result[column.name] = row[column.key];
          break;
        case 'single-select':
          if (!column.data) {
            debug(`No options found`);
            break;
          }
          let options = column.data.options;
          let option = options.find(item => { return item.id === row[column.key];});
          if (option) {
            result[column.name] = option.name;
          } else {
            result[column.name] = '';
          }
          break;
        default:
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
            debug(`No options found, please create a new option`);
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
        case 'formula':
          // don't support formula
          break;
        case 'link':
          if (column.data) {
            result['link'] = Object.assign({}, {newValues: row[key]}, column.data);
            // attention: if listen data-changed, stach overflow(updated -> change -> updated)s
          }
          break;
        default:
          // simple-text/number/collaborator/check/file/date/image
          result[column.key] = row[key];
      }
    }
  }

  return result;
}

export { convertRow, convertRowBack };