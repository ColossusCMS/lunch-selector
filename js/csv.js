// RFC 4180 CSV 파서: 따옴표 안의 쉼표·줄바꿈·"" 이스케이프를 처리한다.

/**
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        field += ch;
      }
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      endField();
    } else if (ch === '\r' && text[i + 1] === '\n') {
      endRow();
      i++;
    } else if (ch === '\n' || ch === '\r') {
      endRow();
    } else {
      field += ch;
    }
    i++;
  }

  // 마지막 줄바꿈 뒤에는 행을 만들지 않는다.
  if (field !== '' || row.length > 0) endRow();
  return rows;
}
