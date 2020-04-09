function convertRow(row, index)
{
  row['Incident Number'] = parseInt(row['Incident Number']);
  return row;
}
