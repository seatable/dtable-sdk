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
            // a single-select column with no options
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
        case 'file':
          result[column.key] = row[key];
          break;
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
        case 'long-text':
          const text = row[key];
          const { preview, images, links } = getPreviewContent(text);
          const value = { text, preview, images, links };
          result[column.key] = value;
          break;
        default:
          result[column.key] = row[key];
      }
    }
  }

  return result;
}

export { convertRow, convertRowBack };