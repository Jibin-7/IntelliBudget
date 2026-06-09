import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import TransactionForm from './TransactionForm';
import TransactionList from './TransactionList';
import SummaryCharts from './SummaryCharts';
import './DashboardPage.css';

function DashboardPage() {
    const [summary, setSummary] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [risk, setRisk] = useState({ level: '', percentage: 0, recommendation: '' });
    const [transactionToEdit, setTransactionToEdit] = useState(null);
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    const handleLogout = useCallback(() => {
        localStorage.removeItem('token');
        window.location.href = '/';
    }, []);

    const fetchDashboardData = useCallback(async () => {
        try {
            const config = { headers: { 'x-access-token': token } };
            // Make API calls in parallel for faster loading
            const [summaryRes, transRes, riskRes] = await Promise.all([
                axios.get('https://intellibudget.onrender.com/api/summary', config),
                axios.get('https://intellibudget.onrender.com/api/transactions', config),
                axios.get(`https://intellibudget.onrender.com/api/risk?_=${new Date().getTime()}`, config)
            ]);

            setSummary(summaryRes.data);
            setTransactions(transRes.data);
            setRisk(riskRes.data);
        } catch (error) {
            console.error("Failed to fetch dashboard data", error);
            if (error.response && error.response.status === 401) {
                handleLogout();
            }
        }
    }, [token, handleLogout]);

    useEffect(() => {
        if (token) {
            fetchDashboardData();
        }
    }, [token, fetchDashboardData]);

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this transaction?")) {
            try {
                await axios.delete(`https://intellibudget.onrender.com/api/transactions/${id}`, {
                    headers: { 'x-access-token': token }
                });
                fetchDashboardData(); // Re-fetch all data
            } catch (error) {
                alert("Failed to delete transaction.");
                console.error(error);
            }
        }
    };
    
    const handleEdit = (transaction) => {
        setTransactionToEdit(transaction);
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    };

    const handleUpdateCancelled = () => {
        setTransactionToEdit(null);
    };

    const getRiskColor = (level) => {
        if (level === 'Extreme') return '#991b1b';
        if (level === 'High') return 'var(--expense-color)';
        if (level === 'Medium') return 'var(--warning-color)';
        return 'var(--income-color)';
    };

    if (!summary) return <div className="page-container"><h2>Loading...</h2></div>;

    const riskPercentage = Math.round(risk.percentage || 0);

    return (
        <div className="page-container">
            <header className="header">
                <h1>Dashboard</h1>
                <div className="header-actions">
                    <Link to="/goals">Savings Goals</Link>
                    <Link to="/groups">Groups</Link>
                    <Link to="/analysis">View Analysis</Link>
                    <button onClick={handleLogout} className="btn btn-secondary">Logout</button>
                </div>
            </header>

            {/* NEW professional grid layout */}
            <main className="dashboard-layout">
                <section className="card summary-card">
                    <h2>Summary</h2>
                    <p>Total Income: <span className="text-income">₹{summary.total_income.toFixed(2)}</span></p>
                    <p>Total Expense: <span className="text-expense">₹{summary.total_expense.toFixed(2)}</span></p>
                    <h3>Balance: ₹{summary.balance.toFixed(2)}</h3>
                    <div style={{ marginTop: 'auto', paddingTop: '1.5rem' }}>
                        <h3>Financial Risk</h3>
                        <p style={{ color: getRiskColor(risk.level), fontSize: '1.1rem' }}>
                            You are at <strong>{riskPercentage}%</strong> risk
                            (<span style={{textTransform: 'capitalize'}}>{risk.level}</span>)
                        </p>
                        {risk.recommendation && (
                            <div className="recommendation-text">
                                💡 {risk.recommendation}
                            </div>
                        )}
                    </div>
                </section>

                <section className="card chart-card">
                    <h3>Expense Breakdown</h3>
                    <SummaryCharts data={summary.expenses_by_category} />
                </section>

                <section className="card transaction-list-card">
                    <h3>Recent Transactions</h3>
                    <TransactionList
                        transactions={transactions}
                        handleEdit={handleEdit}
                        handleDelete={handleDelete}
                    />
                </section>

                <section className="card transaction-form-card">
                    <TransactionForm
                        onTransactionAdded={fetchDashboardData}
                        transactionToEdit={transactionToEdit}
                        onUpdateCancelled={handleUpdateCancelled}
                    />
                </section>
            </main>
        </div>
    );
}

export default DashboardPage;