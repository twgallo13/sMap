import express from 'express';
import type { Request, Response } from 'express';
import axios from 'axios';
import { parse } from 'csv-parse/sync';

const app = express();
const PORT = 3000;

// Helper function to fetch and parse a CSV from a URL
async function fetchAndParseCSV(url: string, startLine: number): Promise<any[]> {
  const response = await axios.get(url);
  const csvData = response.data;
  return parse(csvData, {
    columns: true,
    from_line: startLine,
  });
}

app.get('/api/products', async (req: Request, res: Response) => {
  // URLs from the project plan
  const masterPriceUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxUbhfWe55DhF5bqhhjTv85pEo1up01mEbeIT5QQH4rdRmaa2B8Pq0CUVIbfYHxUQr5-ic4cqdWFZH/pub?output=csv';
  const nikeMapUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQUry3OuGo26H7oTV3nZlRh3k0k0wV82m1Y9mDBXCIH1upQAIlpkYXmal42DB6Cig/pub?output=csv';

  try {
    const [masterPriceData, nikeMapData] = await Promise.all([
      fetchAndParseCSV(masterPriceUrl, 1),
      fetchAndParseCSV(nikeMapUrl, 2)
    ]);

    const mapPrices = new Map<string, number>();
    for (const item of nikeMapData) {
      const mapPriceCents = Math.round(parseFloat(item['MAP Price']) * 100);
      if (!isNaN(mapPriceCents)) {
        mapPrices.set(item['SKU'], mapPriceCents);
      }
    }

    const validatedProducts = masterPriceData.map(product => {
      const sku = product.sku;
      const mapPriceCents = mapPrices.get(sku);
      
      const scomSalePriceCents = Math.round(parseFloat(product['Scom Sale Price']) * 100);

      let status = 'OK';
      let violatingPriceCents = null;

      if (mapPriceCents === undefined) {
        status = 'MAP_MISSING';
      } else if (!isNaN(scomSalePriceCents) && scomSalePriceCents < mapPriceCents) {
        status = 'VIOLATION';
        violatingPriceCents = scomSalePriceCents;
      }

      return {
        sku: sku,
        productName: product.description,
        brand: 'Nike / Jordan',
        status: status,
        mapPriceCents: mapPriceCents || null,
        violatingPriceCents: violatingPriceCents,
        color: product.color,
        gender: product.gender,
        category: product.category
      };
    });

    res.json(validatedProducts);

  } catch (error) {
    console.error('Failed to process sheet data:', error);
    res.status(500).json({ error: 'Failed to retrieve and validate product data' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});