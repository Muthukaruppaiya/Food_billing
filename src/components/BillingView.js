import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Sidebar from './Sidebar';
import './BillingView.css';

export default function BillingView() {
    const { menuItems, todayOrders, closeTokens, username, settings, placeParcelOrder, getNextToken, updateOrderStatus, userId } = useApp();
    const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    const [billView, setBillView] = useState('tables'); // 'tables', 'parcel_new', 'parcels_active'
    const [billingMode, setBillingMode] = useState('TABLES'); // KEEPING FOR COMPATIBILITY OR REPLACING
    const [selectedTable, setSelectedTable] = useState(() => {
        return sessionStorage.getItem('billing_selected_table') || null;
    });
    const [statusTab, setStatusTab] = useState('All');
    const [activeTab, setActiveTab] = useState('All'); // For Parcel Menu categories
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [parcelCart, setParcelCart] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [lastParcelToken, setLastParcelToken] = useState(null);

    const allTabs = [
        { label: 'All', value: 'All' },
        { label: 'Starters', value: 'STARTERS' },
        { label: 'Main Course', value: 'MAIN_COURSE' },
        { label: 'Desserts', value: 'DESSERTS' },
        { label: 'Beverages', value: 'BEVERAGES' },
        { label: 'Side Dish', value: 'SIDE_DISH' }
    ];

    const handleTableSelect = (tableNo) => {
        setSelectedTable(tableNo);
        setPaymentMethod('CASH');
        if (tableNo) {
            sessionStorage.setItem('billing_selected_table', tableNo);
        } else {
            sessionStorage.removeItem('billing_selected_table');
        }
    };

    const billableOrders = todayOrders.filter(o => o.status !== 'BILLED');
    const activeTables = [...new Set(billableOrders.map(o => o.tableNumber))].sort((a, b) => a - b);

    const billedOrders = todayOrders.filter(o => o.status === 'BILLED' && !o.isParcel);

    // Aggregate tokens for the selected table
    const tableTokens = selectedTable ? billableOrders.filter(o => o.tableNumber === selectedTable) : [];

    // Combine items from all tokens of the selected table
    let combinedItems = [];
    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;
    let total = 0;

    tableTokens.forEach(token => {
        combinedItems = [...combinedItems, ...token.items.map(i => ({ ...i, tokenNumber: token.tokenNumber }))];
        subtotal += token.subtotal;
        cgst += token.cgst;
        sgst += token.sgst;
        total += token.total;
    });

    // Parcel Calculations
    let parcelSubtotal = parcelCart.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
    let parcelTaxEnabled = settings.enableTax;
    let parcelCgst = parcelTaxEnabled ? (parcelSubtotal * 0.025) : 0;
    let parcelSgst = parcelTaxEnabled ? (parcelSubtotal * 0.025) : 0;
    let parcelTotal = parcelSubtotal + parcelCgst + parcelSgst;

    const filteredMenu = menuItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTab = activeTab === 'All' || item.type === activeTab;
        return matchesSearch && matchesTab;
    });

    const addToParcelCart = (item) => {
        setParcelCart(prev => {
            const exists = prev.find(i => i.id === item.id);
            if (exists) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
            return [...prev, { ...item, qty: 1 }];
        });
    };

    const updateParcelQty = (id, delta) => {
        setParcelCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0));
    };

    const handleGenerateBill = async () => {
        if (billingMode === 'TABLES') {
            if (!selectedTable || tableTokens.length === 0) return;

            const billingData = {
                tokenNumbers: tableTokens.map(t => t.tokenNumber),
                tableNumber: selectedTable.toString(),
                customerName: "Guest",
                paymentMethod: paymentMethod,
                restaurantType: "STANDALONE",
                notes: `Combined bill for table ${selectedTable}`
            };

            try {
                await closeTokens(billingData);
                handleTableSelect(null);
                alert("Table Bill Generated Successfully!");
            } catch (error) {
                alert("Failed to close tokens.");
            }
        } else {
            // Parcel Order
            if (parcelCart.length === 0) return;
            try {
                const result = await placeParcelOrder(parcelCart, paymentMethod, username);
                setParcelCart([]);
                // API returns tokenNumber (e.g. 9001) and billNumber (e.g. "PCL-20260306-...")
                setLastParcelToken({
                    tokenNumber: result.tokenNumber ? `P${result.tokenNumber}` : 'P---',
                    billNumber: result.billNumber || '',
                    hotelName: settings.restaurantName,
                    date: new Date().toLocaleDateString(),
                    time: new Date().toLocaleTimeString()
                });
            } catch (error) {
                console.error('Parcel order error:', error);
                alert("Failed to create parcel order. Check console for details.");
            }
        }
    };

    const handleHandover = async (parcelOrder) => {
        if (!window.confirm(`Mark Token #${parcelOrder.tokenNumber} as Delivered & Billed?`)) return;
        try {
            await updateOrderStatus(parcelOrder.tokenNumber, 'BILLED');
            alert("Parcel Completed!");
        } catch (error) {
            alert("Failed to close parcel.");
        }
    };

    return (
        <div className="app-layout">
            <Sidebar>
                <button className={`nav-btn ${billView === 'tables' ? 'active' : ''}`} onClick={() => { setBillView('tables'); setBillingMode('TABLES'); }}>
                    🏢 Table Billing
                </button>
                <button className={`nav-btn ${billView === 'parcel_new' ? 'active' : ''}`} onClick={() => { setBillView('parcel_new'); setBillingMode('PARCEL'); }}>
                    📦 New Parcel
                </button>
                <button className={`nav-btn ${billView === 'parcels_active' ? 'active' : ''}`} onClick={() => setBillView('parcels_active')}>
                    🎫 Active Tokens {todayOrders.filter(o => o.isParcel && o.status !== 'BILLED').length > 0 && (
                        <span className="nav-count">{todayOrders.filter(o => o.isParcel && o.status !== 'BILLED').length}</span>
                    )}
                </button>
                <button className={`nav-btn ${billView === 'parcel_history' ? 'active' : ''}`} onClick={() => setBillView('parcel_history')}>
                    📜 Parcel History
                </button>
            </Sidebar>

            <main className="main-content">
                <header className="top-bar">
                    <h2>{billView === 'tables' ? 'Table Billing' : billView === 'parcel_new' ? 'New Parcel Order' : billView === 'parcel_history' ? 'Parcel History' : 'Active Tokens'}</h2>
                </header>

                {/* Parcel Alert Banner */}
                {todayOrders.some(o => (o.status === 'PLACED' || o.status === 'READY') && o.isParcel) && (
                    <div className="ready-food-alert" style={{ margin: '16px 24px' }}>
                        <div className="ready-alert-content">
                            <span className="ready-icon-pulse">🔔</span>
                            <span>Parcel Order(s) Pending! Check Active Tokens.</span>
                        </div>
                        <button className="view-ready-btn" onClick={() => { setBillView('parcels_active'); setStatusTab('PLACED'); }}>View Details</button>
                    </div>
                )}

                {billView === 'tables' ? (
                    <>
                        <div className="status-tabs-container" style={{ margin: '16px 24px 0' }}>
                            {['All', 'PLACED', 'DELIVERED', 'BILLED'].map(status => (
                                <button
                                    key={status}
                                    className={`status-tab pill-${status.toLowerCase() || 'all'} ${statusTab === status ? 'active' : ''}`}
                                    onClick={() => setStatusTab(status)}
                                >
                                    {status === 'All' ? 'Active Tables' : status === 'PLACED' ? 'New Orders' : status === 'DELIVERED' ? 'Ready to Bill' : 'Billed'}
                                    <span className="count">
                                        {status === 'All' ? activeTables.length :
                                            status === 'BILLED' ? billedOrders.length :
                                                [...new Set(todayOrders.filter(o => o.status === status && !o.isParcel).map(o => o.tableNumber))].length}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <section className="token-grid">
                            {statusTab === 'BILLED' ? (
                                billedOrders.length === 0 ? <div className="empty-full"><p>No billed history found.</p></div> : (
                                    billedOrders.map(order => (
                                        <div className={`token-card status-billed faded`} key={order.tokenNumber}>
                                            <div className="token-header">
                                                <div><span className="token-id">Token #{order.tokenNumber}</span><span className="table-badge">Table {order.tableNumber}</span></div>
                                                <span className="status-pill billed">Billed</span>
                                            </div>
                                            <div className="token-footer">
                                                <span className="token-time">{new Date(order.createdAt).toLocaleDateString()}</span>
                                                <span className="token-total">₹{toNum(order.total).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    ))
                                )
                            ) : (
                                (() => {
                                    const tables = billableOrders.filter(o => !o.isParcel);

                                    const activeTableNums = [...new Set(tables.map(o => o.tableNumber))].sort((a, b) => a - b);
                                    const filteredTableNums = statusTab === 'All' ? activeTableNums : activeTableNums.filter(num => tables.some(o => o.tableNumber === num && o.status === statusTab));

                                    return (
                                        <div className="active-split" style={{ width: '100%' }}>
                                            {filteredTableNums.length === 0 ? (
                                                <div className="empty-full"><p>No {statusTab !== 'All' ? statusTab.toLowerCase() : ''} tables found.</p></div>
                                            ) : (
                                                <div className="token-grid">
                                                    {filteredTableNums.map(tableNo => {
                                                        const tokensForTable = tables.filter(o => o.tableNumber === tableNo);
                                                        const tableTotal = tokensForTable.reduce((acc, curr) => acc + toNum(curr.total), 0);
                                                        return (
                                                            <div className={`token-card status-preparing clickable ${selectedTable === tableNo ? 'selected' : ''}`}
                                                                key={tableNo} onClick={() => handleTableSelect(tableNo)}>
                                                                <div className="token-header">
                                                                    <div><span className="token-id">Table #{tableNo}</span></div>
                                                                    <span className="status-pill placed">{tokensForTable.length} Tokens</span>
                                                                </div>
                                                                <div className="token-footer">
                                                                    <span className="token-total">₹{toNum(tableTotal).toFixed(2)}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()
                            )}
                        </section>
                    </>
                ) : billView === 'parcels_active' ? (
                    <>
                        <div className="status-tabs-container" style={{ margin: '16px 24px 0' }}>
                            {['All', 'PLACED', 'DELIVERED'].map(status => (
                                <button
                                    key={status}
                                    className={`status-tab pill-${status.toLowerCase() || 'all'} ${statusTab === status ? 'active' : ''}`}
                                    onClick={() => setStatusTab(status)}
                                >
                                    {status === 'All' ? 'All Tokens' : status === 'PLACED' ? 'Active' : 'Billed'}
                                    <span className="count">
                                        {status === 'All' ? todayOrders.filter(o => o.isParcel && o.status !== 'BILLED').length :
                                            todayOrders.filter(o => o.isParcel && o.status === status).length}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <section className="token-grid" style={{ padding: '24px' }}>
                            {(() => {
                                const parcels = todayOrders.filter(o => o.isParcel && o.status !== 'BILLED');
                                const filteredParcels = statusTab === 'All' ? parcels : parcels.filter(o => o.status === statusTab);

                                if (filteredParcels.length === 0) return <div className="empty-full"><p>No {statusTab !== 'All' ? statusTab.toLowerCase() : ''} tokens found.</p></div>;

                                return filteredParcels.map(order => (
                                    <div className={`token-card status-${String(order.status).toLowerCase()} ${order.status === 'READY' ? 'pulse-ready' : ''}`} key={order.tokenNumber}>
                                        <div className="token-header">
                                            <div><span className="token-id">Token #{order.tokenNumber}</span></div>
                                            <span className={`status-pill ${String(order.status).toLowerCase()}`}>{order.status}</span>
                                        </div>
                                        <div className="token-items" style={{ maxHeight: '120px', overflowY: 'auto' }}>
                                            {order.items.map((item, i) => (
                                                <div key={i} className="token-item-row" style={{ fontSize: '13px', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                                                    <strong>{item.itemName}</strong> × {item.quantity}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="token-footer" style={{ marginTop: 'auto', paddingTop: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                                <span className="token-total">₹{toNum(order.total).toFixed(2)}</span>
                                                <span className="token-time">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            {(order.status === 'PLACED' || order.status === 'PREPARING' || order.status === 'READY') && (
                                                <button className="handover-btn" style={{ width: '100%', marginTop: '12px', padding: '10px' }} onClick={() => handleHandover(order)}>✓ Handover & Finalize Bill</button>
                                            )}
                                            {order.status === 'DELIVERED' && (
                                                <span style={{ display: 'block', marginTop: '10px', color: '#16a34a', fontWeight: 600, fontSize: '13px' }}>✓ Completed</span>
                                            )}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </section>
                    </>
                ) : billView === 'parcel_history' ? (
                    <section className="token-grid" style={{ padding: '24px' }}>
                        {todayOrders.filter(o => o.isParcel && o.status === 'BILLED').length === 0 ? (
                            <div className="empty-full"><p>No parcel history found for today.</p></div>
                        ) : (
                            todayOrders.filter(o => o.isParcel && o.status === 'BILLED').reverse().map((order, idx) => (
                                <div className="token-card status-delivered faded" key={order.tokenNumber || idx}>
                                    <div className="token-header">
                                        <div>
                                            <span className="token-id">Parcel Token #{order.tokenNumber}</span>
                                            <span className="table-badge">Parcel</span>
                                        </div>
                                        <span className="status-pill delivered">BILLED</span>
                                    </div>
                                    <div className="token-items">
                                        {order.items.map((item, iidx) => (
                                            <div key={iidx} className="token-item-row">
                                                <span>{item.itemName}</span>
                                                <span>× {item.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="token-footer">
                                        <span className="token-time">Time: {new Date(order.createdAt).toLocaleTimeString()}</span>
                                        <span className="token-total">₹{toNum(order.total).toFixed(2)}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </section>
                ) : (
                    <div className="parcel-mode-content">
                        <div className="search-bar-wrap">
                            <input
                                type="text"
                                placeholder="🔍 Search menu items (e.g. Biryani, Coffee)..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="menu-search-input"
                            />
                        </div>

                        <div className="cat-tabs" style={{ padding: '0 0 16px 0', borderBottom: 'none' }}>
                            {allTabs.map(tab => (
                                <button
                                    key={tab.value}
                                    className={`cat-tab ${activeTab === tab.value ? 'active' : ''}`}
                                    onClick={() => setActiveTab(tab.value)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="menu-grid" style={{ padding: '0' }}>
                            {filteredMenu.map(item => (
                                <div className="food-card" key={item.id} onClick={() => addToParcelCart(item)} style={{ padding: '8px' }}>
                                    <div className="food-img" style={{ height: '90px' }}>
                                        <img src={item.imageUrl || item.image} alt={item.name} />
                                        <span className="food-badge" style={{ fontSize: '9px' }}>{item.type}</span>
                                    </div>
                                    <div className="food-info" style={{ gap: '0' }}>
                                        <h3 style={{ fontSize: '13px', margin: '2px 0' }}>{item.name}</h3>
                                        <p className="food-price">₹{item.price}</p>
                                    </div>
                                    <button className="add-btn" style={{ bottom: '8px', right: '8px', width: '24px', height: '24px', fontSize: '14px' }}>+</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            <aside className="invoice-panel">
                {lastParcelToken && billingMode === 'PARCEL' ? (
                    <div className="parcel-token-result">
                        <div className="receipt-container" id="printable-receipt" style={{ textAlign: 'center' }}>
                            <div className="receipt-header">
                                <h1>{lastParcelToken.hotelName}</h1>
                                {settings.phone && <p>Ph: {settings.phone}</p>}
                            </div>
                            <div className="dashed-line"></div>
                            <div style={{ fontSize: '11px', fontWeight: 700, margin: '4px 0 2px' }}>PARCEL TOKEN</div>
                            <div style={{ fontSize: '22px', fontWeight: 900, margin: '6px 0', letterSpacing: '1px' }}>
                                #{lastParcelToken.tokenNumber}
                            </div>
                            <div className="dashed-line"></div>
                            <div className="receipt-meta-row" style={{ justifyContent: 'center', gap: '8px' }}>
                                <span>{lastParcelToken.date}</span>
                                <span>{lastParcelToken.time}</span>
                            </div>
                            <div className="dashed-line"></div>
                            <div className="marketing-msg">Order Ready — Please Collect</div>
                        </div>
                        <button className="secondary-btn" onClick={() => window.print()} style={{ marginTop: '20px', width: '100%' }}>🖨️ Print Token</button>
                        <button className="primary-btn" onClick={() => { setLastParcelToken(null); setBillView('parcels_active'); }} style={{ marginTop: '10px', width: '100%' }}>Done</button>
                    </div>
                ) : (billingMode === 'TABLES' ? selectedTable : (parcelCart.length > 0)) ? (
                    <div className="receipt-container" id="printable-receipt">
                        {/* ── Header ── */}
                        <div className="receipt-header">
                            <h1>{settings.restaurantName}</h1>
                            {settings.address && <p>{settings.address}</p>}
                            {settings.city && <p>{settings.city}</p>}
                            {settings.phone && <p>Ph: {settings.phone}</p>}
                            {settings.gstin && <p>GSTIN: {settings.gstin}</p>}
                        </div>

                        <div className="dashed-line"></div>

                        {/* ── Bill info ── */}
                        <div className="receipt-bill-info">
                            <div className="receipt-table-no">
                                {billingMode === 'TABLES'
                                    ? `Table No: ${selectedTable.toString().padStart(2, '0')}`
                                    : 'PARCEL ORDER'}
                            </div>
                            {billingMode === 'PARCEL' && (
                                <div style={{ fontSize: '11px', fontWeight: 700 }}>Token #{getNextToken('PARCEL')}</div>
                            )}
                            <div className="receipt-meta-row">
                                <span>{new Date().toLocaleDateString('en-IN')}</span>
                                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                <span>Cashier: {username || 'Admin'}</span>
                            </div>
                        </div>

                        <div className="dashed-line"></div>

                        {/* ── Column headers ── */}
                        <div className="receipt-table-header">
                            <span>Q</span>
                            <span>Item</span>
                            <span style={{ textAlign: 'right' }}>Rate</span>
                            <span style={{ textAlign: 'right' }}>Amt</span>
                        </div>

                        {/* ── Items ── */}
                        <div className="receipt-items">
                            {billingMode === 'TABLES' ? (
                                combinedItems.map((item, idx) => (
                                    <div className="receipt-item-row" key={idx}>
                                        <span className="item-qty">{item.quantity}</span>
                                        <span className="item-name">{item.itemName}</span>
                                        <span className="item-price">{toNum(item.price).toFixed(2)}</span>
                                        <span className="item-amount">{(toNum(item.price) * toNum(item.quantity)).toFixed(2)}</span>
                                    </div>
                                ))
                            ) : (
                                parcelCart.map((item, idx) => (
                                    <div className="receipt-item-row" key={idx}>
                                        {/* qty: show controls on screen, plain number on print */}
                                        <div className="qty-controls no-print" style={{ gridColumn: '1', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                            <button onClick={() => updateParcelQty(item.id, -1)}>−</button>
                                            <span>{item.qty}</span>
                                            <button onClick={() => updateParcelQty(item.id, 1)}>+</button>
                                        </div>
                                        <span className="item-qty print-only">{item.qty}</span>
                                        <span className="item-name">{item.name}</span>
                                        <span className="item-price">{toNum(item.price).toFixed(2)}</span>
                                        <span className="item-amount">{(toNum(item.price) * toNum(item.qty)).toFixed(2)}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="dashed-line"></div>

                        {/* ── Totals ── */}
                        <div className="receipt-totals">
                            <div className="total-row">
                                <span>Subtotal</span>
                                <span>{toNum(billingMode === 'TABLES' ? subtotal : parcelSubtotal).toFixed(2)}</span>
                            </div>
                            {settings.enableTax && (
                                <>
                                    <div className="total-row">
                                        <span>CGST @2.5%</span>
                                        <span>{toNum(billingMode === 'TABLES' ? cgst : parcelCgst).toFixed(2)}</span>
                                    </div>
                                    <div className="total-row">
                                        <span>SGST @2.5%</span>
                                        <span>{toNum(billingMode === 'TABLES' ? sgst : parcelSgst).toFixed(2)}</span>
                                    </div>
                                </>
                            )}
                            <div className="dashed-line"></div>
                            <div className="total-row grand-total">
                                <span>TOTAL</span>
                                <span>Rs.{toNum(billingMode === 'TABLES' ? total : parcelTotal).toFixed(2)}</span>
                            </div>
                            <div className="dashed-line"></div>
                        </div>

                        {/* ── Payment ── */}
                        <div className="receipt-payment">
                            <p className="payment-label">Payment Mode</p>
                            <div className="payment-row">
                                <span>{paymentMethod}</span>
                                <span>Rs.{toNum(billingMode === 'TABLES' ? total : parcelTotal).toFixed(2)}</span>
                            </div>
                            <div className="payment-meta">
                                <p>Balance: 0.00</p>
                            </div>
                        </div>

                        <div className="dashed-line"></div>

                        {/* ── Footer ── */}
                        <div className="receipt-footer">
                            {settings.termsConditions && (
                                <div className="terms-wrap">
                                    <strong>T&amp;C:</strong> {settings.termsConditions}
                                </div>
                            )}
                            <div className="marketing-msg" style={{ whiteSpace: 'pre-line' }}>
                                {settings.footerMessage || 'Thank you!\nVisit us again!'}
                            </div>
                        </div>

                        <div className="inv-actions no-print">
                            <div className="payment-method-selector">
                                <label>Payment Method:</label>
                                <div className="pay-options">
                                    {['CASH', 'CARD', 'UPI/QR'].map(method => (
                                        <button
                                            key={method}
                                            className={`pay-btn ${paymentMethod === method ? 'active' : ''}`}
                                            onClick={() => setPaymentMethod(method)}
                                        >
                                            {method === 'CASH' ? '💵 Cash' : method === 'CARD' ? '💳 Card' : '📱 UPI/QR'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button className="secondary-btn print-btn" onClick={() => window.print()}>
                                🖨️ Print Final Receipt
                            </button>
                            <button className="primary-btn" onClick={handleGenerateBill}>
                                {billingMode === 'TABLES' ? 'Complete Sale & Close Table' : `Complete Sale (#${getNextToken('PARCEL')})`}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="empty-hint" style={{ marginTop: '80px' }}>
                        <p>{billingMode === 'TABLES' ? '← Select a table to generate bill' : '← Search and add items to parcel'}</p>
                    </div>
                )}
            </aside>
        </div>
    );
}
