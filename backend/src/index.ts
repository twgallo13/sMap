import express, { Request, Response } from 'express';
import axios from 'axios';
import { parse } from 'csv-parse';

const app = express();
const PORT = 3000;

app.get('/api/products', async (req: Request, res: Response) => {
  const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQUry3OuGo26H7oTV3nZlRh3k0k0wV82m1Y9mDBXCIH1upQAIlpkYXmal42DB6Cig/pub?output=csv';

  try {
    const response = await axios.get(sheetUrl);
    const csvData = response.data;

    const parser = parse(csvData, {
      columns: true,
      from_line: 2
    });

    const records = [];
    for await (const record of parser) {
      records.push({
        sku: record['SKU'],
        productName: 'Product Name TBD',
        status: 'OK',
        brand: 'Nike / Jordan'
      });
    }
    
    res.json(records);

  } catch (error) {
    console.error('Failed to fetch or parse sheet data:', error);
    res.status(500).json({ error: 'Failed to retrieve product data' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});