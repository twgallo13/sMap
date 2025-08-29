import express from 'express';
import type { Request, Response } from 'express';
import axios from 'axios';
import { parse } from 'csv-parse/sync';

const app = express();
const PORT = 3000;

// --- DYNAMIC CONFIGURATION (from Project Plan) ---
const dataSources = {
    master: {
        url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxUbhfWe55DhF5bqhhjTv85pEo1up01mEbeIT5QQH4rdRmaa2B8Pq0CUVIbfYHxUQr5-ic4cqdWFZH/pub?output=csv',
        headerRow: 1,
        columns: {
            sku: 'sku',
            productName: 'description',
            brand: 'brand',
            ricsRetailCents: 'RicsRetailPrice',
            ricsOfferCents: 'Ricsofferprice',
            scomCents: 'Scom Price',
            scomSaleCents: 'Scom Sale Price'
        }
    },
    brands: [
        { name: 'Nike / Jordan', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQUry3OuGo26H7oTV3nZlRh3k0k0wV82m1Y9mDBXCIH1upQAIlpkYXmal42DB6Cig/pub?output=csv', headerRow: 2, skuColumn: 'SKU', mapColumn: 'MAP Price' },
        { name: 'Adidas', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTVE1EueNaZebSSEluaC2rmOT0YOZAVncIxQmOKRVCuT7dLuy9uu4aD8IMfj6nvHA/pub?output=csv', headerRow: 2, skuColumn: 'SKU', mapColumn: 'MAP' },
        { name: 'New Balance', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTna228DtiB54_PP6ZRNi7i2Ocbt8fYXEap05kVaMkGyQnebBqfl16yAm9BMEKfEw/pub?output=csv', headerRow: 2, skuColumn: 'SKU', mapColumn: 'Price' },
        { name: 'Puma', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRZvhcSwzg6uE6dHOOANX_4DBqIP_cUEHycIjfMwFpjONxofEgWbkFsdlOL-JDm2w/pub?output=csv', headerRow: 2, skuColumn: 'SKU', mapColumn: 'MAP Price' },
        { name: 'Vans', url: 'https://docs.google.com/spreadsheets/d/e/1fWuFi84Rr4rzSCxghp_DmnF_bbwHjptB/export?format=csv&id=1fWuFi84Rr4rzSCxghp_DmnF_bbwHjptB&gid=709961168', headerRow: 9, skuColumn: 'SKU', mapColumn: 'MAP Price' }
    ]
};

// --- HELPER FUNCTIONS ---
function parsePriceToCents(price: string | null | undefined): number | null {
    if (price === null || price === undefined || price.trim() === '') return null;
    const parsed = parseFloat(price.replace(/[^0-9.-]+/g,""));
    return isNaN(parsed) ? null : Math.round(parsed * 100);
}

async function fetchAndParseCSV(url: string, startLine: number): Promise<any[]> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const csvData = new TextDecoder('utf-8').decode(response.data);
    return parse(csvData, { columns: true, from_line: startLine, relax_column_count: true });
}

// --- API ENDPOINT ---
app.get('/api/products', async (req: Request, res: Response) => {
    try {
        console.log("Starting data fetch...");
        const brandPromises = dataSources.brands.map(brand => fetchAndParseCSV(brand.url, brand.headerRow));
        const allBrandData = await Promise.all(brandPromises);

        const mapPrices = new Map<string, { price: number; brand: string }>();
        allBrandData.forEach((brandData, index) => {
            const brandConfig = dataSources.brands[index];
            for (const item of brandData) {
                const sku = item[brandConfig.skuColumn];
                const mapPriceCents = parsePriceToCents(item[brandConfig.mapColumn]);
                if (sku && mapPriceCents !== null) {
                    mapPrices.set(sku.trim(), { price: mapPriceCents, brand: brandConfig.name });
                }
            }
        });
        console.log(`Consolidated ${mapPrices.size} unique MAP prices.`);

        const masterPriceData = await fetchAndParseCSV(dataSources.master.url, dataSources.master.headerRow);
        console.log(`Fetched ${masterPriceData.length} products from the master file.`);

        const validatedProducts = masterPriceData.map(product => {
            const sku = product[dataSources.master.columns.sku]?.trim();
            if (!sku) return null;

            const mapInfo = mapPrices.get(sku);
            const mapPriceCents = mapInfo?.price;
            
            const ricsRetailCents = parsePriceToCents(product[dataSources.master.columns.ricsRetailCents]);
            const ricsOfferCents = parsePriceToCents(product[dataSources.master.columns.ricsOfferCents]);
            const scomCents = parsePriceToCents(product[dataSources.master.columns.scomCents]);
            const scomSaleCents = parsePriceToCents(product[dataSources.master.columns.scomSaleCents]);

            let status = 'OK';
            let violatingPriceCents = null;
            let violatingSource = null;

            if (mapPriceCents === undefined || mapPriceCents === null) {
                status = 'MAP_MISSING';
            } else {
                const effectiveWeb = scomCents ?? ricsRetailCents;
                const effectiveWebSale = scomSaleCents ?? ricsOfferCents;
                
                const pricesToCheck = [
                    { price: ricsRetailCents, source: 'RETAIL' },
                    { price: ricsOfferCents, source: 'RETAIL_OFFER' },
                    { price: effectiveWeb, source: 'WEB' },
                    { price: effectiveWebSale, source: 'WEB_SALE' },
                ];

                for (const item of pricesToCheck) {
                    if (item.price !== null && item.price < mapPriceCents) {
                        status = 'VIOLATION';
                        violatingPriceCents = item.price;
                        violatingSource = item.source;
                        break;
                    }
                }
            }

            return {
                sku: sku,
                productName: product[dataSources.master.columns.productName],
                brand: product[dataSources.master.columns.brand] || mapInfo?.brand || 'Unknown',
                status: status,
                mapPriceCents: mapPriceCents || null,
                violatingPriceCents: violatingPriceCents,
                violatingSource: violatingSource,
            };
        }).filter(p => p !== null);

        console.log(`Validation complete. Returning ${validatedProducts.length} products.`);
        res.json(validatedProducts);

    } catch (error) {
        // This is the updated block
        let errorMessage = 'Failed to retrieve and validate product data';
        if (error instanceof Error) {
            // Now we know it's a real error, we can safely access its message
            errorMessage = error.message;
        }
        console.error('An error occurred during the price check process:', errorMessage);
        res.status(500).json({ error: errorMessage });
    }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});