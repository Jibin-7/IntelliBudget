import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import TrendsView from './TrendsView';
import CalendarView from './CalendarView';
import './AnalysisPage.css';

function AnalysisPage() {
    const [activeTab, setActiveTab] = useState('trends'); // 'trends' or 'calendar'
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const token = localStorage.getItem('token');

    // Fetch all transactions once for the calendar view
    useEffect(() => {
        const fetchAllTransactions = async () => {
            try {
                const config = { headers: { 'x-access-token': token } };
                const res = await axios.get('https://intellibudget.onrender.com/api/transactions', config);
                setTransactions(res.data);
            } catch (error) {
                console.error("Failed to fetch transactions", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAllTransactions();
    }, [token]);

    const tabButtonStyle = (tabName) => ({
        padding: '10px 20px',
        fontSize: '1em',
        border: 'none',
        borderBottom: activeTab === tabName ? '3px solid #007bff' : '3px solid transparent',
        cursor: 'pointer',
        background: 'none'
    });

return (
        <div className="page-container">
            <header className="header">
                <h1>Financial Analysis</h1>
                <Link to="/dashboard" className="back-link">Back to Dashboard</Link>
            </header>

            <div className="tab-controls">
                <button
                    className={`tab-button ${activeTab === 'trends' ? 'active' : ''}`}
                    onClick={() => setActiveTab('trends')}
                >
                    Spending Trends
                </button>
                <button
                    className={`tab-button ${activeTab === 'calendar' ? 'active' : ''}`}
                    onClick={() => setActiveTab('calendar')}
                >
                    Calendar View
                </button>
            </div>

            <div className="card">
                {loading ? (
                    <p>Loading data...</p>
                ) : (
                    <div>
                        {activeTab === 'trends' && <TrendsView />}
                        {activeTab === 'calendar' && <CalendarView transactions={transactions} />}
                    </div>
                )}
            </div>
        </div>
    );
}

export default AnalysisPage;