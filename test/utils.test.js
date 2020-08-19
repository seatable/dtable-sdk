import Utils from '../src/utils';

const utils = new Utils();

describe('utils test', () => {
  it('format a valid date', () => {
    let date = new Date('2018-08-19');
    let formateDate = utils.formatDate(date);
    expect(formateDate).toBe('2018-08-19');
  });
  
  it('format a valid date', () => {
    let date = new Date();
    let formateDate = utils.formatDate(date);
    expect(formateDate.length).toBe(10);
  });

  it('format a valid date', () => {
    let date = new Date('2018-08-19 06:00');
    let formateDate = utils.formatDateWithMinutes(date);
    expect(formateDate).toBe('2018-08-19 06:00');
  });
  
  it('format a valid date', () => {
    let date = new Date();
    let formateDate = utils.formatDateWithMinutes(date);
    expect(formateDate.length).toBe(16);
  });

  it('format a valid date', () => {
    let date = new Date('aaa');
    let formateDate = utils.formatDateWithMinutes(date);
    expect(formateDate).toBe('Invalid date');
  });
})