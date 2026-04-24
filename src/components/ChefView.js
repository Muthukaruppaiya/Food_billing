import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import Sidebar from './Sidebar';
import './ChefView.css';

export default function ChefView() {
    const { todayOrders, updateOrderStatus, updateItemStatus } = useApp();
    const [selectedToken, setSelectedToken] = useState(null);
    const [statusTab, setStatusTab] = useState('ALL_ACTIVE');

    // Filter based on statusTab - ONLY TODAY
    const chefOrders = todayOrders.filter(o => {
        if (statusTab === 'ALL_ACTIVE') return ['PLACED', 'PREPARING'].includes(o.status);
        return o.status === statusTab;
    });

    const completedOrdersCount = todayOrders.filter(o => o.status === 'READY').length;

    const activeOrder = selectedToken ? todayOrders.find(o => o.tokenNumber === selectedToken) : null;

    // If the order we're viewing moves to READY/DELIVERED/BILLED, go back to queue
    useEffect(() => {
        if (activeOrder && ['READY', 'DELIVERED', 'BILLED'].includes(activeOrder.status)) {
            setSelectedToken(null);
        }
    }, [activeOrder]);

    return (
        <div className="app-layout">
            <Sidebar>
                <button className={`nav-btn ${!selectedToken ? 'active' : ''}`} onClick={() => setSelectedToken(null)}>
                    Kitchen Queue {chefOrders.length > 0 && <span className="nav-count">{chefOrders.length}</span>}
                </button>
                {selectedToken && (
                    <button className="nav-btn active">
                        Preparing Token #{selectedToken}
                    </button>
                )}
            </Sidebar>

            <main className="main-content">
                {!selectedToken ? (
                    <>
                        <header className="top-bar">
                            <h2>Kitchen Queue</h2>
                            <div className="status-tabs-container" style={{ border: 'none', padding: '0' }}>
                                {[
                                    { id: 'ALL_ACTIVE', label: 'Active' },
                                    { id: 'PLACED', label: 'New' },
                                    { id: 'PREPARING', label: 'Preparing' },
                                    { id: 'READY', label: 'Ready' }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        className={`status-tab pill-${tab.id.toLowerCase()} ${statusTab === tab.id ? 'active' : ''}`}
                                        onClick={() => setStatusTab(tab.id)}
                                    >
                                        {tab.label}
                                        <span className="count">
                                            {tab.id === 'ALL_ACTIVE' ? todayOrders.filter(o => ['PLACED', 'PREPARING'].includes(o.status)).length : todayOrders.filter(o => o.status === tab.id).length}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </header>

                        <section className="token-grid">
                            {chefOrders.length === 0 ? (
                                <div className="empty-full"><p>🎉 No {statusTab === 'ALL_ACTIVE' ? 'active' : statusTab.toLowerCase()} orders right now.</p></div>
                            ) : (
                                chefOrders.map(order => (
                                    <div className={`token-card status-${String(order.status || 'PLACED').toLowerCase()} clickable-card`}
                                        key={order.tokenNumber}
                                        onClick={() => setSelectedToken(order.tokenNumber)}>
                                        <div className="token-header">
                                            <div><span className="token-id">Token #{order.tokenNumber}</span><span className="table-badge">{(order.tableNumber === '0' || !order.tableNumber) ? 'Parcel' : `Table ${order.tableNumber}`}</span></div>
                                            <span className={`status-pill ${String(order.status || 'PLACED').toLowerCase()}`}>{order.status}</span>
                                        </div>
                                        <div className="token-items">
                                            {order.items.slice(0, 3).map(item => (
                                                <div key={item.id} className={`token-item-row ${item.status === 'FINISHED' ? 'finished-row' : ''}`}>
                                                    <span>{item.itemName} {item.status === 'FINISHED' && '✓'}</span>
                                                    <span>× {item.quantity}</span>
                                                </div>
                                            ))}
                                            {order.items.length > 3 && (
                                                <div className="more-items">+{order.items.length - 3} more items...</div>
                                            )}
                                        </div>
                                        <div className="token-time">Received: {new Date(order.createdAt).toLocaleTimeString()}</div>
                                        {order.status !== 'READY' && <div className="click-to-open">Tap to open →</div>}
                                    </div>
                                ))
                            )}
                        </section>
                    </>
                ) : activeOrder ? (
                    <div className="detail-view-container">
                        <header className="detail-header">
                            <button className="back-btn" onClick={() => setSelectedToken(null)}>← Back to Queue</button>
                            <div className="detail-title-group">
                                <h2>Order Token #{activeOrder.tokenNumber}</h2>
                                <span className="table-large">{(activeOrder.tableNumber === '0' || !activeOrder.tableNumber) ? 'Parcel' : `Table ${activeOrder.tableNumber}`}</span>
                            </div>
                        </header>

                        <div className="detail-content-card">
                            <div className="detail-status-banner">
                                <span className="status-label">Current State:</span>
                                <span className={`status-pill-large ${String(activeOrder.status).toLowerCase()}`}>{activeOrder.status}</span>
                            </div>

                            <div className="items-list-large">
                                <h3>Order Items</h3>
                                {activeOrder.items.map(item => {
                                    const isFinished = item.status === 'FINISHED';
                                    return (
                                        <div key={item.id} className={`item-row-large ${isFinished ? 'item-finished' : ''}`}>
                                            <div className="item-info">
                                                <span className="item-name-lg">{item.itemName}</span>
                                                <span className="item-price-lg">₹{item.price}</span>
                                            </div>
                                            <div className="item-qty-actions">
                                                <span className="item-qty-lg">× {item.quantity}</span>
                                                {!isFinished && activeOrder.status === 'PREPARING' && (
                                                    <button className="finish-item-btn" onClick={() => updateItemStatus(activeOrder.tokenNumber, item.id, 'FINISHED')}>
                                                        Finish
                                                    </button>
                                                )}
                                                {isFinished && <span className="item-done-icon">✅</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                                {activeOrder.items.some(i => i.status === 'FINISHED') && (
                                    <div className="finished-items-hint" style={{ marginTop: '15px', color: '#16a34a', fontSize: '13px', fontWeight: '600' }}>
                                        ✓ {activeOrder.items.filter(i => i.status === 'FINISHED').length} items completed
                                    </div>
                                )}
                            </div>

                            <div className="detail-actions-fixed">
                                {activeOrder.status === 'PLACED' && (
                                    <button className="huge-btn cook-btn" onClick={() => updateOrderStatus(activeOrder.tokenNumber, 'PREPARING')}>
                                        🔥 START PREPARATION
                                    </button>
                                )}
                                {activeOrder.status === 'PREPARING' && (
                                    <button className="huge-btn ready-btn-huge" onClick={() => updateOrderStatus(activeOrder.tokenNumber, 'READY')}>
                                        ✅ MARK AS PREPARED
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="detail-view-container">
                        <header className="detail-header">
                            <button className="back-btn" onClick={() => setSelectedToken(null)}>← Back to Queue</button>
                        </header>
                        <div className="empty-full"><p>Order no longer available or loading...</p></div>
                    </div>
                )}
            </main>
        </div>
    );
}
