

import { render } from 'preact';
import { html } from 'htm/preact';
import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const mockUpdates = [
  { state: "RUNNING", phase: "Ingesting data...", progress: 25 },
  { state: "RUNNING", phase: "Validating prices...", progress: 75 },
  { state: "COMPLETED", phase: "Done", progress: 100 }
];

const mockProducts = [
  { sku: 'AB123 100', productName: 'Retro Runner - White', brand: 'Nike / Jordan', mapPriceCents: 12000, violatingPriceCents: 11999, status: 'VIOLATION', color: 'White', gender: 'Men', category: 'Running', violatingSource: 'RICS' },
  { sku: 'CD456-200', productName: 'Trail Blazer High', brand: 'Adidas', mapPriceCents: 15000, violatingPriceCents: null, status: 'OK', color: 'Black', gender: 'Unisex', category: 'Basketball', violatingSource: null },
  { sku: 'EF789-300', productName: 'Classic Suede', brand: 'Puma', mapPriceCents: null, violatingPriceCents: null, status: 'MAP_MISSING', color: 'Red', gender: 'Women', category: 'Lifestyle', violatingSource: null },
  { sku: 'GH012 400', productName: 'Air Max 90', brand: 'Nike / Jordan', mapPriceCents: 13000, violatingPriceCents: 12500, status: 'VIOLATION', color: 'Infrared', gender: 'Men', category: 'Lifestyle', violatingSource: 'SCOM' },
  { sku: 'IJ345-500', productName: 'Ultraboost 21', brand: 'Adidas', mapPriceCents: 18000, violatingPriceCents: null, status: 'OK', color: 'Triple Black', gender: 'Men', category: 'Running', violatingSource: null },
  { sku: 'KL678-600', productName: 'Chuck Taylor All Star', brand: 'Converse', mapPriceCents: 6000, violatingPriceCents: null, status: 'OK', color: 'White', gender: 'Unisex', category: 'Skate', violatingSource: null },
  { sku: 'MN901-700', productName: 'Old Skool', brand: 'Vans', mapPriceCents: 6500, violatingPriceCents: 6499, status: 'VIOLATION', color: 'Black/White', gender: 'Unisex', category: 'Skate', violatingSource: 'RICS' },
  { sku: 'OP234-800', productName: 'Gel-Kayano 28', brand: 'ASICS', mapPriceCents: 16000, violatingPriceCents: null, status: 'OK', color: 'Blue', gender: 'Men', category: 'Running', violatingSource: null },
  { sku: 'QR567-900', productName: 'Fresh Foam 880v11', brand: 'New Balance', mapPriceCents: 13000, violatingPriceCents: null, status: 'OK', color: 'Grey', gender: 'Women', category: 'Running', violatingSource: null },
  { sku: 'ST890 111', productName: 'Jordan 1 Mid', brand: 'Nike / Jordan', mapPriceCents: 11500, violatingPriceCents: 11000, status: 'VIOLATION', color: 'Bred', gender: 'Men', category: 'Basketball', violatingSource: 'SCOM' },
  { sku: 'UV123-222', productName: 'Superstar', brand: 'Adidas', mapPriceCents: null, violatingPriceCents: null, status: 'MAP_MISSING', color: 'White/Black', gender: 'Unisex', category: 'Lifestyle', violatingSource: null },
  { sku: 'WX456-333', productName: 'RS-X³', brand: 'Puma', mapPriceCents: 11000, violatingPriceCents: null, status: 'OK', color: 'Multi', gender: 'Men', category: 'Lifestyle', violatingSource: null },
];

const mockTolerances = [
  { brandName: 'Nike / Jordan', mapToleranceCents: 100 },
  { brandName: 'Adidas', mapToleranceCents: 50 },
  { brandName: 'New Balance', mapToleranceCents: 0 },
  { brandName: 'Puma', mapToleranceCents: 75 },
  { brandName: 'Vans', mapToleranceCents: 0 }
];

const mockDataSources = [
    { id: 'master', name: 'Master Price Check', googleSheetUrl: 'https://docs.google.com/spreadsheets/d/master-sheet', headerRow: 1, columnMappings: { 'SKU': 'sku', 'MAP Price': 'mapPriceCents' } },
    { id: 'nike-jordan', name: 'Nike / Jordan', googleSheetUrl: 'https://docs.google.com/spreadsheets/d/nike-jordan-sheet', headerRow: 2, columnMappings: { 'style': 'styleCode', 'sku': 'sku', 'productName': 'productName', 'color': 'color', 'MAP': 'mapPriceCents' } },
    { id: 'adidas', name: 'Adidas', googleSheetUrl: 'https://docs.google.com/spreadsheets/d/adidas-sheet', headerRow: 1, columnMappings: { 'SKU': 'sku', 'Name': 'productName', 'Retail Price': 'mapPriceCents' } },
    { id: 'new-balance', name: 'New Balance', googleSheetUrl: 'https://docs.google.com/spreadsheets/d/new-balance-sheet', headerRow: 2, columnMappings: { 'Item SKU': 'sku', 'Description': 'productName', 'Price': 'mapPriceCents' } },
];

const SYSTEM_FIELDS = ['sku', 'productName', 'brand', 'mapPriceCents', 'violatingPriceCents', 'status', 'color', 'gender', 'category', 'styleCode'];


const allBrands = [...new Set(mockProducts.map(p => p.brand))];
const allStatuses = ["OK", "VIOLATION", "MAP_MISSING"];

const brandMappings = {
  'Nike / Jordan': { headerRow: 2, note: 'SKU is Style (D) + Colorway (D). Dashes in SKU are replaced with spaces.', mappings: { C: 'styleCode', D: 'sku', E: 'productName', F: 'color', K: 'gender', L: 'class', M: 'price (MAP)', P: 'promoAllowed', Q: 'promoPrice' } },
  'Adidas': { headerRow: 1, mappings: { A: 'category', B: 'productName', C: 'color', E: 'sku', F: 'price (retail)', I: 'mapOrPromo', K: 'mapStartDate', L: 'mapEndDate' } },
  'Puma': { headerRow: 3, mappings: { A: 'sku', B: 'productName', C: 'color', D: 'price (MAP)', F: 'category', G: 'gender' } },
  'New Balance': { headerRow: 1, mappings: { I: 'sku', C: 'productName', J: 'color', N: 'price (MAP)', E: 'gender', B: 'category', F: 'promo', R: 'exception', O: 'mapEndDate' } },
  'Vans': { headerRow: 9, mappings: { B: 'category', C: 'sku', D: 'productName', E: 'color', F: 'price' } },
};


const formatCurrency = (cents) => {
  if (cents === null || cents === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
};

// --- CSV Generation Utilities ---
const sanitizeForCSV = (value) => {
  if (value === null || value === undefined) return '';
  const strValue = String(value);
  if (['=', '+', '-', '@'].some(char => strValue.startsWith(char))) {
    return `'${strValue}`;
  }
  return strValue;
};
const convertToCSV = (data, headers) => {
  const headerKeys = Object.keys(headers);
  const headerRow = headerKeys.map(key => `"${sanitizeForCSV(headers[key])}"`).join(',');
  const dataRows = data.map(row => {
    return headerKeys.map(key => `"${sanitizeForCSV(row[key])}"`).join(',');
  });
  return [headerRow, ...dataRows].join('\n');
};
const downloadCSV = (csvString, filename) => {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

// --- Reusable Icon Component ---
function Icon({ path, size = 24 }) {
    return html`
        <svg xmlns="http://www.w3.org/2000/svg" width=${size} height=${size} viewBox="0 0 24 24" fill="currentColor">
            <path d=${path}></path>
        </svg>
    `;
}

// --- Base Modal Logic ---
function useModal(modalRef, isOpen, onClose) {
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Tab') {
                const focusableElements = modalRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (!focusableElements || focusableElements.length === 0) return;
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        e.preventDefault();
                    }
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        setTimeout(() => modalRef.current?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus(), 0);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, modalRef]);
}

// --- Modal Components ---
function ExportModal({ isOpen, onClose, productsToExport }) {
  const modalRef = useRef(null);
  useModal(modalRef, isOpen, onClose);
  if (!isOpen) return null;

  const handleDefaultExport = () => {
    const headers = { sku: 'SKU', productName: 'Product Name', brand: 'Brand', status: 'Status', mapPriceCents: 'MAP Price (Cents)', violatingPriceCents: 'Violating Price (Cents)' };
    const csv = convertToCSV(productsToExport, headers);
    downloadCSV(csv, 'default_export.csv');
    onClose();
  };
  const handleRicsExport = () => {
    const headers = { sku: 'SKU', mapPriceCents: 'MAP Price' };
    const data = productsToExport.map(p => ({ sku: p.sku, mapPriceCents: p.mapPriceCents ? (p.mapPriceCents / 100).toFixed(2) : '' }));
    const csv = convertToCSV(data, headers);
    downloadCSV(csv, 'rics_format.csv');
    onClose();
  };
  const handleWebPriceUpdateExport = () => {
    const headers = { sku: 'SKU', price: 'Price', salePrice: 'Sale Price' };
    const data = productsToExport.filter(p => p.mapPriceCents !== null && p.mapPriceCents > 0).map(p => {
        const adjustedPriceCents = (p.mapPriceCents % 100 === 0) ? p.mapPriceCents - 1 : p.mapPriceCents;
        const price = (adjustedPriceCents / 100).toFixed(2);
        return { sku: p.sku, price, salePrice: price };
    });
    const csv = convertToCSV(data, headers);
    downloadCSV(csv, 'web_price_update.csv');
    onClose();
  };
  return html`
    <div class="modal-overlay" onClick=${onClose}>
      <div class="modal-content" ref=${modalRef} onClick=${e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="export-modal-title">
        <div class="modal-header">
          <h2 id="export-modal-title">Export Options</h2>
          <button class="modal-close-button" onClick=${onClose} aria-label="Close modal">&times;</button>
        </div>
        <div class="modal-body">
            <p>Select an export format for the ${productsToExport.length} filtered products.</p>
            <div class="export-options">
                <button onClick=${handleDefaultExport}>Default CSV</button>
                <button onClick=${handleRicsExport}>RICS Format</button>
                <button onClick=${handleWebPriceUpdateExport}>Web Price Update</button>
            </div>
        </div>
      </div>
    </div>
  `;
}

function SettingsModal({ isOpen, onClose }) {
    const modalRef = useRef(null);
    const [activeTab, setActiveTab] = useState(Object.keys(brandMappings)[0]);
    useModal(modalRef, isOpen, onClose);
    if (!isOpen) return null;
    
    const activeMapping = brandMappings[activeTab];

    return html`
        <div class="modal-overlay" onClick=${onClose}>
            <div class="modal-content settings-modal" ref=${modalRef} onClick=${e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
                <div class="modal-header">
                    <h2 id="settings-modal-title">Brand Column Mappings</h2>
                    <button class="modal-close-button" onClick=${onClose} aria-label="Close modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="settings-tabs">
                        ${Object.keys(brandMappings).map(brand => html`
                            <button
                                role="tab"
                                class=${`tab-button ${activeTab === brand ? 'active' : ''}`}
                                onClick=${() => setActiveTab(brand)}
                                aria-selected=${activeTab === brand}
                            >
                                ${brand}
                            </button>
                        `)}
                    </div>
                    <div class="settings-content" role="tabpanel">
                        <div class="mapping-info">
                            <p><strong>Header Row:</strong> ${activeMapping.headerRow}</p>
                            <p><strong>Note:</strong> Mappings are by column letter, not header name.</p>
                            ${activeMapping.note && html`<p><strong>Brand Rule:</strong> ${activeMapping.note}</p>`}
                        </div>
                        <ul class="mapping-list">
                            ${Object.entries(activeMapping.mappings).map(([col, field]) => html`
                                <li>
                                    <span class="column-letter">${col}</span>
                                    <span class="arrow">→</span>
                                    <span class="field-name">${field}</span>
                                </li>
                            `)}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function ProductDetailModal({ isOpen, onClose, product }) {
    const modalRef = useRef(null);
    const [marketCheckState, setMarketCheckState] = useState('idle'); // 'idle', 'checking', 'done', 'error'
    const [marketData, setMarketData] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');

    useModal(modalRef, isOpen, onClose);

    useEffect(() => {
        if (isOpen) {
            setMarketCheckState('idle');
            setMarketData([]);
            setErrorMessage('');
        }
    }, [isOpen]);

    const handleMarketCheck = async () => {
        if (!product) return;
        setMarketCheckState('checking');
        setErrorMessage('');
        
        try {
            const prompt = `Find the current market price for the shoe '${product.productName}' with SKU '${product.sku}' from popular competitors like StockX, GOAT, and Flight Club. Provide the response as a JSON array where each object has 'competitor' (a string) and 'priceCents' (an integer representing the price in cents). If you cannot find data, return an empty array.`;

            const responseSchema = {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        competitor: { type: Type.STRING },
                        priceCents: { type: Type.INTEGER },
                    },
                    required: ["competitor", "priceCents"],
                },
            };

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });

            const result = JSON.parse(response.text);
            setMarketData(result);
            setMarketCheckState('done');
        } catch (error) {
            console.error("AI Market Check failed:", error);
            setErrorMessage("Sorry, the AI market check failed. Please try again later.");
            setMarketCheckState('error');
        }
    };
    
    if (!isOpen || !product) return null;

    const renderMarketCheckContent = () => {
        switch (marketCheckState) {
            case 'done':
                return html`
                    <div class="market-check-results">
                        <h4>Competitor Pricing</h4>
                        ${marketData.length > 0 ? html`
                            <ul class="competitor-list">
                                ${marketData.map(item => html`
                                    <li key=${item.competitor}>
                                        <span class="competitor-name">${item.competitor}</span>
                                        <span class="competitor-price">${formatCurrency(item.priceCents)}</span>
                                    </li>
                                `)}
                            </ul>
                        ` : html`<p>No competitor data found.</p>`}
                    </div>
                `;
            case 'error':
                return html`
                    <div class="market-check-results">
                        <p class="market-check-error">${errorMessage}</p>
                    </div>
                `;
            default:
                return null;
        }
    };
    
    const getButtonText = () => {
        switch (marketCheckState) {
            case 'checking': return 'Checking...';
            case 'error': return 'Try Again';
            case 'done': return 'Check Again';
            default: return 'AI Market Check';
        }
    };

    return html`
        <div class="modal-overlay" onClick=${onClose}>
            <div class="modal-content product-detail-modal" ref=${modalRef} onClick=${e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
                <div class="modal-header">
                    <h2 id="product-modal-title">${product.productName}</h2>
                    <button class="modal-close-button" onClick=${onClose} aria-label="Close modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="product-detail-grid">
                        <div class="detail-item"><span class="detail-label">SKU</span><span class="detail-value">${product.sku}</span></div>
                        <div class="detail-item"><span class="detail-label">Brand</span><span class="detail-value">${product.brand}</span></div>
                        <div class="detail-item"><span class="detail-label">Color</span><span class="detail-value">${product.color || 'N/A'}</span></div>
                        <div class="detail-item"><span class="detail-label">Gender</span><span class="detail-value">${product.gender || 'N/A'}</span></div>
                        <div class="detail-item"><span class="detail-label">Category</span><span class="detail-value">${product.category || 'N/A'}</span></div>
                        <div class="detail-item"><span class="detail-label">Status</span><span class="detail-value">
                            <span class="status-badge status-${product.status.toLowerCase()}">${product.status.replace('_', ' ')}</span>
                        </span></div>
                        <div class="detail-item"><span class="detail-label">MAP Price</span><span class="detail-value">${formatCurrency(product.mapPriceCents)}</span></div>
                        <div class="detail-item"><span class="detail-label">Violating Price</span><span class="detail-value ${product.status === 'VIOLATION' ? 'violation-price' : ''}">${formatCurrency(product.violatingPriceCents)}</span></div>
                    </div>
                    ${renderMarketCheckContent()}
                </div>
                <div class="modal-footer">
                    <button 
                        class="action-button secondary" 
                        onClick=${handleMarketCheck} 
                        disabled=${marketCheckState === 'checking'}
                    >
                        ${getButtonText()}
                    </button>
                </div>
            </div>
        </div>
    `;
}

function ProgressIndicator({ phase, progress }) {
    return html`
        <div class="progress-container" aria-live="polite">
          <p class="phase-text">${phase}</p>
          <div class="progress-bar-wrapper" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100" aria-label="Job progress">
            <div class="progress-bar" style="width: ${progress}%;"></div>
          </div>
        </div>
    `;
}

// --- View Components ---
function AnalyticsScorecard({ products }) {
    if (!products || products.length === 0) return null;

    const violations = products.filter(p => p.status === 'VIOLATION');
    const totalProducts = products.length;
    const totalViolations = violations.length;

    // 1. Price Mix (Violating vs OK)
    const violationPercentage = totalProducts > 0 ? (totalViolations / totalProducts) * 100 : 0;

    // 2. Violations by Source
    const violationsBySource = violations.reduce((acc, p) => {
        const source = p.violatingSource || 'Unknown';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
    // FIX: Add type assertion to reducer's initial value to prevent type errors.
    }, {} as Record<string, number>);

    // 3. Sale (Violating) Items by Brand
    const violationsByBrand = violations.reduce((acc, p) => {
        acc[p.brand] = (acc[p.brand] || 0) + 1;
        return acc;
    // FIX: Add type assertion to reducer's initial value to prevent type errors.
    }, {} as Record<string, number>);
    
    // 4. Top Violation Insight
    // FIX: Explicitly cast sorting values to Number to prevent type errors in arithmetic operations.
    const topViolatingBrand = Object.entries(violationsByBrand).sort((a, b) => Number(b[1]) - Number(a[1]))[0] || ['N/A', 0];

    return html`
        <div class="analytics-scorecard">
            <div class="scorecard-item">
                <h4>Price Mix (Violations)</h4>
                <div class="metric">${violationPercentage.toFixed(1)}%</div>
                <div class="sub-metric">${totalViolations} of ${totalProducts} products</div>
                <div class="progress-bar-wrapper small">
                    <div class="progress-bar" style="width: ${violationPercentage}%;"></div>
                </div>
            </div>
            <div class="scorecard-item">
                <h4>Violations by Source</h4>
                <ul class="metric-list">
                    ${Object.entries(violationsBySource).map(([source, count]) => html`
                        <li key=${source}><span>${source}</span><span>${count}</span></li>
                    `)}
                </ul>
            </div>
            <div class="scorecard-item">
                <h4>Violating Items by Brand</h4>
                <ul class="metric-list">
                    {/* FIX: Explicitly cast sorting values to Number to prevent type errors in arithmetic operations. */}
                    ${Object.entries(violationsByBrand).sort((a, b) => Number(b[1]) - Number(a[1])).map(([brand, count]) => html`
                        <li key=${brand}><span>${brand}</span><span>${count}</span></li>
                    `)}
                </ul>
            </div>
            <div class="scorecard-item">
                <h4>Top Violation Insight</h4>
                <div class="metric">${topViolatingBrand[0]}</div>
                <div class="sub-metric">Brand with most violations (${topViolatingBrand[1]} items)</div>
            </div>
        </div>
    `;
}

function DashboardView({ jobState, products, filteredProducts, handleRunCheck, openModal, setIsExportModalOpen, handleRowClick, searchTerm, setSearchTerm, handleBrandsChange, handleStatusesChange, exportButtonRef, sortConfig, handleSort }) {
    const lastUpdated = "2025-08-28 3:44 PM";
    
    const getSortArrow = (key) => {
        if (sortConfig.key !== key) return '';
        return sortConfig.direction === 'ascending' ? '▲' : '▼';
    };
    
    return html`
        ${jobState !== 'running' && products.length === 0 && html`
            <div class="actions">
                <button class="action-button" onClick=${handleRunCheck} disabled=${jobState === 'running'}>
                    Run Full Price Check
                </button>
                <p class="last-updated-text">Source Prices Last Updated: ${lastUpdated}</p>
            </div>
        `}
        ${products.length > 0 && html`
            <div class="product-view-container">
                <${AnalyticsScorecard} products=${products} />
                <div class="table-actions">
                    <div class="filters-container">
                        <input type="search" placeholder="Search by SKU or Name..." value=${searchTerm} onInput=${(e) => setSearchTerm(e.currentTarget.value)} aria-label="Search products" />
                        <select multiple onChange=${handleBrandsChange} aria-label="Filter by brand">
                            <option value="" disabled>Brand</option>
                            ${allBrands.map(brand => html`<option value=${brand}>${brand}</option>`)}
                        </select>
                        <select multiple onChange=${handleStatusesChange} aria-label="Filter by status">
                            <option value="" disabled>Status</option>
                            ${allStatuses.map(status => html`<option value=${status}>${status}</option>`)}
                        </select>
                    </div>
                    <button class="export-button" onClick=${openModal(setIsExportModalOpen)} ref=${exportButtonRef} aria-haspopup="true">Export</button>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th onClick=${() => handleSort('sku')}>SKU ${getSortArrow('sku')}</th>
                                <th onClick=${() => handleSort('productName')}>Product Name ${getSortArrow('productName')}</th>
                                <th onClick=${() => handleSort('brand')}>Brand ${getSortArrow('brand')}</th>
                                <th onClick=${() => handleSort('status')}>Status ${getSortArrow('status')}</th>
                                <th onClick=${() => handleSort('color')}>Color ${getSortArrow('color')}</th>
                                <th onClick=${() => handleSort('gender')}>Gender ${getSortArrow('gender')}</th>
                                <th onClick=${() => handleSort('category')}>Category ${getSortArrow('category')}</th>
                                <th onClick=${() => handleSort('mapPriceCents')}>MAP Price ${getSortArrow('mapPriceCents')}</th>
                                <th onClick=${() => handleSort('violatingPriceCents')}>Violating Price ${getSortArrow('violatingPriceCents')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredProducts.length > 0 ? filteredProducts.map(product => html`
                            <tr key=${product.sku} onClick=${() => handleRowClick(product)} tabIndex="0" onKeyDown=${(e) => (e.key === 'Enter' || e.key === ' ') && handleRowClick(product)}>
                                <td>${product.sku}</td>
                                <td>${product.productName}</td>
                                <td>${product.brand}</td>
                                <td><span class="status-badge status-${product.status.toLowerCase()}">${product.status.replace('_', ' ')}</span></td>
                                <td>${product.color}</td>
                                <td>${product.gender}</td>
                                <td>${product.category}</td>
                                <td>${formatCurrency(product.mapPriceCents)}</td>
                                <td class=${product.status === 'VIOLATION' ? 'violation-price' : ''}>${formatCurrency(product.violatingPriceCents)}</td>
                            </tr>
                            `) : html`
                            <tr><td colspan="9">No products found.</td></tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        `}
    `;
}

function ToleranceSettingsPanel({ tolerances, onToleranceChange, onSaveChanges, onBack, jobState, progress, phase }) {
    return html`
        <div class="tolerance-settings-panel">
            <h2>Brand Tolerance Settings</h2>
            <p>Set the MAP tolerance in cents for each brand. A violation is triggered if the price is below (MAP - tolerance).</p>
            
            ${jobState === 'running' ? html`
                <${ProgressIndicator} phase=${phase} progress=${progress} />
            ` : html`
                <div class="tolerance-list">
                    ${tolerances.map((t, index) => html`
                        <div class="tolerance-item" key=${t.brandName}>
                            <label for="tolerance-${index}">${t.brandName}</label>
                            <div class="input-wrapper">
                                <input
                                    type="number"
                                    id="tolerance-${index}"
                                    value=${t.mapToleranceCents}
                                    onInput=${e => onToleranceChange(index, e.currentTarget.value)}
                                    min="0"
                                    step="1"
                                />
                                <span>cents</span>
                            </div>
                        </div>
                    `)}
                </div>
                <div class="settings-actions">
                    <button class="action-button secondary" onClick=${onBack}>Back to Dashboard</button>
                    <button class="action-button" onClick=${onSaveChanges}>Save Changes</button>
                </div>
            `}
        </div>
    `;
}

function DataSourcePanel({ sources, onSaveChanges, onBack }) {
    const [selectedSourceId, setSelectedSourceId] = useState(sources[0]?.id);
    const [formData, setFormData] = useState(null);

    useEffect(() => {
        const selected = sources.find(s => s.id === selectedSourceId);
        if (selected) {
            setFormData(JSON.parse(JSON.stringify(selected))); // Deep copy to avoid direct state mutation
        }
    }, [selectedSourceId, sources]);

    const handleFormChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };
    
    const handleMappingChange = (index, type, value) => {
        setFormData(prev => {
            const newMappings = { ...prev.columnMappings };
            const entries = Object.entries(newMappings);
            const [oldKey, oldValue] = entries[index];
            
            if (type === 'key') {
                delete newMappings[oldKey];
                newMappings[value] = oldValue;
            } else { // type === 'value'
                newMappings[oldKey] = value;
            }

            return { ...prev, columnMappings: newMappings };
        });
    };
    
    const addMapping = () => {
        setFormData(prev => ({
            ...prev,
            columnMappings: { ...prev.columnMappings, 'New Column': '' }
        }));
    };

    const removeMapping = (key) => {
        setFormData(prev => {
            const newMappings = { ...prev.columnMappings };
            delete newMappings[key];
            return { ...prev, columnMappings: newMappings };
        });
    };
    
    const handleSave = (e) => {
        e.preventDefault();
        onSaveChanges(formData);
    };

    if (!formData) return html`<p>Loading...</p>`;

    const mappingEntries = Object.entries(formData.columnMappings);

    return html`
        <div class="data-source-panel">
            <div class="source-list-pane">
                <h3>Data Sources</h3>
                <ul class="source-list">
                    ${sources.map(source => html`
                        <li key=${source.id}>
                            <button
                                class="source-list-item ${source.id === selectedSourceId ? 'active' : ''}"
                                onClick=${() => setSelectedSourceId(source.id)}
                            >
                                ${source.name}
                            </button>
                        </li>
                    `)}
                </ul>
            </div>
            <div class="source-config-pane">
                <form class="config-form" onSubmit=${handleSave}>
                    <h2>Configure ${formData.name}</h2>
                    <div class="form-group">
                        <label for="sourceName">Source Name</label>
                        <input type="text" id="sourceName" value=${formData.name} onInput=${e => handleFormChange('name', e.currentTarget.value)} />
                    </div>
                    <div class="form-group">
                        <label for="sheetUrl">Google Sheet URL</label>
                        <input type="url" id="sheetUrl" value=${formData.googleSheetUrl} onInput=${e => handleFormChange('googleSheetUrl', e.currentTarget.value)} />
                    </div>
                    <div class="form-group">
                        <label for="headerRow">Header Row</label>
                        <input type="number" id="headerRow" value=${formData.headerRow} min="1" onInput=${e => handleFormChange('headerRow', parseInt(e.currentTarget.value, 10) || 1)} />
                    </div>

                    <div class="column-mappings-section">
                        <h4>Column Mappings</h4>
                        <p>Map source column headers to system fields.</p>
                        <div class="mapping-header">
                            <span>Source Column Header</span>
                            <span>System Field</span>
                        </div>
                        ${mappingEntries.map(([sourceHeader, systemField], index) => html`
                            <div class="mapping-row" key=${index}>
                                <input type="text" value=${sourceHeader} onInput=${e => handleMappingChange(index, 'key', e.currentTarget.value)} placeholder="e.g., SKU" />
                                <span class="arrow">→</span>
                                <select value=${systemField} onChange=${e => handleMappingChange(index, 'value', e.currentTarget.value)}>
                                    <option value="">Select Field...</option>
                                    ${SYSTEM_FIELDS.map(field => html`<option value=${field}>${field}</option>`)}
                                </select>
                                <button type="button" class="remove-mapping-btn" onClick=${() => removeMapping(sourceHeader)} aria-label="Remove mapping">&times;</button>
                            </div>
                        `)}
                        <button type="button" class="add-mapping-btn" onClick=${addMapping}>+ Add Mapping</button>
                    </div>

                    <div class="settings-actions">
                        <button type="button" class="action-button secondary" onClick=${onBack}>Back to Dashboard</button>
                        <button type="submit" class="action-button">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}


// --- Main App Component ---
function App() {
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'toleranceSettings', 'dataSourceSettings'
  const [jobState, setJobState] = useState('idle'); // 'idle', 'running'
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [tolerances, setTolerances] = useState(mockTolerances);
  const [dataSources, setDataSources] = useState(mockDataSources);
  const [sortConfig, setSortConfig] = useState({ key: 'sku', direction: 'ascending' });
  
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const exportButtonRef = useRef(null);
  const lastFocusedElementRef = useRef(null);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    let result = [...products];
    if (debouncedSearchTerm) {
      result = result.filter(p => p.productName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || p.sku.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
    }
    if (selectedBrands.length > 0) {
      result = result.filter(p => selectedBrands.includes(p.brand));
    }
    if (selectedStatuses.length > 0) {
      result = result.filter(p => selectedStatuses.includes(p.status));
    }
    if (sortConfig.key) {
        result.sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            if (valA === null) return 1;
            if (valB === null) return -1;
            if (valA < valB) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (valA > valB) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
    }
    setFilteredProducts(result);
  }, [products, debouncedSearchTerm, selectedBrands, selectedStatuses, sortConfig]);

  // FIX: Make onComplete parameter optional to match usage where it is not always provided.
  const runJob = useCallback((onComplete?) => {
    setJobState('running');
    setProgress(0);
    setPhase('Starting...');
    if (products.length > 0) setProducts([]); // Clear old results if they exist
    
    let updateIndex = 0;
    const runUpdate = () => {
      if (updateIndex >= mockUpdates.length) return;
      const update = mockUpdates[updateIndex];
      setProgress(update.progress);
      setPhase(update.phase);
      if (update.state === 'COMPLETED') {
        setTimeout(() => {
          setJobState('idle');
          setProducts(mockProducts);
          setNotificationMessage('Price check complete. 4 violations found.');
          setShowNotification(true);
          setTimeout(() => {
            setShowNotification(false);
            setNotificationMessage('');
          }, 5000);
          if (onComplete) onComplete();
        }, 500);
      } else {
         setTimeout(runUpdate, 1500);
      }
      updateIndex++;
    };
    setTimeout(runUpdate, 1000);
  }, [products]);

  const handleRunCheck = useCallback(() => runJob(), [runJob]);

  const handleToleranceChange = (index, value) => {
    const newTolerances = [...tolerances];
    newTolerances[index].mapToleranceCents = parseInt(value, 10) || 0;
    setTolerances(newTolerances);
  };
  
  const handleSaveTolerances = useCallback(() => {
    const revalidationJobId = 'mock-reval-456';
    console.log('Saving tolerances and starting revalidation job:', revalidationJobId);
    
    setNotificationMessage('Settings updated. Re-validating all products...');
    setShowNotification(true);
    
    runJob(() => {
      setTimeout(() => {
        setCurrentView('dashboard');
      }, 2000);
    });
  }, [runJob, tolerances]);
  
  const handleSaveDataSource = (updatedSource) => {
    console.log('Saving data source:', updatedSource);
    setDataSources(prevSources => prevSources.map(s => s.id === updatedSource.id ? updatedSource : s));
    setNotificationMessage(`${updatedSource.name} data source updated.`);
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
      setNotificationMessage('');
    }, 5000);
    setCurrentView('dashboard');
  };
  
  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleBrandsChange = useCallback((e) => {
    const options = [...e.target.selectedOptions];
    setSelectedBrands(options.map(option => option.value));
  }, []);

  const handleStatusesChange = useCallback((e) => {
    const options = [...e.target.selectedOptions];
    setSelectedStatuses(options.map(option => option.value));
  }, []);
  
  const openModal = (setter) => () => {
      lastFocusedElementRef.current = document.activeElement;
      setter(true);
  };
  
  const closeModal = (setter) => () => {
      setter(false);
      lastFocusedElementRef.current?.focus();
  };

  const handleRowClick = (product) => {
      setSelectedProduct(product);
      // FIX: The function returned by openModal expects 0 arguments. Call it without arguments.
      openModal(setIsProductModalOpen)();
  };
  
  const renderView = () => {
      switch (currentView) {
          case 'toleranceSettings':
              return html`<${ToleranceSettingsPanel} tolerances=${tolerances} onToleranceChange=${handleToleranceChange} onSaveChanges=${handleSaveTolerances} onBack=${() => setCurrentView('dashboard')} jobState=${jobState} progress=${progress} phase=${phase} />`;
          case 'dataSourceSettings':
              return html`<${DataSourcePanel} sources=${dataSources} onSaveChanges=${handleSaveDataSource} onBack=${() => setCurrentView('dashboard')} />`;
          case 'dashboard':
          default:
              return html`<${DashboardView} jobState=${jobState} products=${products} filteredProducts=${filteredProducts} handleRunCheck=${handleRunCheck} openModal=${openModal} setIsExportModalOpen=${setIsExportModalOpen} handleRowClick=${handleRowClick} searchTerm=${searchTerm} setSearchTerm=${setSearchTerm} handleBrandsChange=${handleBrandsChange} handleStatusesChange=${handleStatusesChange} exportButtonRef=${exportButtonRef} sortConfig=${sortConfig} handleSort=${handleSort} />`;
      }
  };

  return html`
    <main class="dashboard" aria-labelledby="dashboard-title">
      <h1 id="dashboard-title" class="sr-only">Price Check Dashboard</h1>
      
      <div class="dashboard-header">
        <h1>Shiekh MAP Monitor</h1>
        <div class="header-actions">
            <button class="icon-button" onClick=${() => setCurrentView('dataSourceSettings')} aria-label="Open Data Source Settings">
                <${Icon} path="M12 3L2 8v11h20V8L12 3zm7 15h-4v-4h4v4zm0-6h-4V8h4v4zM9 18H5v-4h4v4zm0-6H5V8h4v4zm6 0h-4V8h4v4z"/>
            </button>
            <button class="icon-button" onClick=${() => setCurrentView('toleranceSettings')} aria-label="Open Tolerance Settings">
                <${Icon} path="M3 17v2h18v-2H3m4-4v2h10v-2H7m4-4v2h2V9h-2m10-4H1v2h22V5Z"/>
            </button>
            <button class="icon-button" onClick=${openModal(setIsSettingsModalOpen)} aria-label="Open Column Mapping Settings">
                <${Icon} path="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.44,0.17-0.48,0.41L9.2,5.77C8.61,6.01,8.08,6.33,7.58,6.71L5.19,5.75C4.97,5.68,4.72,5.75,4.6,5.97L2.68,9.29 c-0.11,0.2-0.06,0.47,0.12,0.61l2.03,1.58C4.78,11.76,4.76,12.08,4.76,12.4c0,0.32,0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.04,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.48-0.41l0.36-2.54c0.59-0.24,1.12-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0.01,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
            </button>
        </div>
      </div>
      
      ${showNotification && html`
          <div class="notification" role="status">
            ${notificationMessage}
          </div>
      `}

      ${jobState === 'running' && currentView === 'dashboard' && html`
        <${ProgressIndicator} phase=${phase} progress=${progress} />
      `}
      
      ${renderView()}

    </main>
    <${ExportModal} isOpen=${isExportModalOpen} onClose=${closeModal(setIsExportModalOpen)} productsToExport=${filteredProducts} />
    <${SettingsModal} isOpen=${isSettingsModalOpen} onClose=${closeModal(setIsSettingsModalOpen)} />
    <${ProductDetailModal} isOpen=${isProductModalOpen} onClose=${closeModal(setIsProductModalOpen)} product=${selectedProduct} />
  `;
}

render(html`<${App} />`, document.getElementById('root'));