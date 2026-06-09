// GoalsPage.js
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './GoalsPage.css';

function GoalsPage() {
    const [goals, setGoals] = useState([]);
    const [name, setName] = useState('');
    const [goalAmount, setGoalAmount] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [loading, setLoading] = useState(true);
    const token = localStorage.getItem('token');

    const fetchGoals = useCallback(async () => {
        setLoading(true);
        try {
            const config = { headers: { 'x-access-token': token } };
            const res = await axios.get('https://intellibudget.onrender.com/api/goals', config);
            setGoals(res.data);
        } catch (error) {
            console.error("Failed to fetch goals", error);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (token) {
            fetchGoals();
        }
    }, [token, fetchGoals]);

    // Helper: safe currency formatting and edge-case handling
    const formatCurrencySafe = (value) => {
        if (value === null || value === undefined) return '—';
        const num = Number(value);
        if (!isFinite(num)) return 'Too large — update date';
        if (Math.abs(num) > 1e9) return 'Too large — update date';
        return `₹${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / mo`;
    };

    // Helper: compute months remaining from date string if backend doesn't send it
    const computeMonthsRemaining = (dateStr) => {
        if (!dateStr) return null;
        try {
            // ensure consistent timezone handling
            const target = new Date(dateStr + 'T00:00:00');
            const now = new Date();
            const diffDays = (target - now) / (1000 * 60 * 60 * 24);
            if (diffDays <= 0) return 0;
            return diffDays / 30.44;
        } catch (e) {
            return null;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Basic client-side validation: require future date
        const todayStr = new Date().toISOString().slice(0, 10);
        if (!targetDate) {
            return alert('Please choose a target date.');
        }
        if (targetDate <= todayStr) {
            return alert('Please choose a future date for your goal.');
        }

        try {
            const config = { headers: { 'x-access-token': token } };
            await axios.post('https://intellibudget.onrender.com/api/goals', { name, goal_amount: goalAmount, target_date: targetDate }, config);
            fetchGoals(); // Re-fetch goals after adding a new one
            setName('');
            setGoalAmount('');
            setTargetDate('');
        } catch (error) {
            console.error('Failed to add goal.', error);
            alert('Failed to add goal.');
        }
    };
    
    const handleDelete = async (goalId) => {
        if (window.confirm("Are you sure you want to delete this goal?")) {
            try {
                const config = { headers: { 'x-access-token': token } };
                await axios.delete(`https://intellibudget.onrender.com/api/goals/${goalId}`, config);
                fetchGoals(); // Re-fetch goals after deleting
            } catch (error) {
                alert('Failed to delete goal.');
            }
        }
    };

    const getLikelihoodClass = (level) => {
        if (level === 'High') return 'status-high';
        if (level === 'Medium') return 'status-medium';
        if (level === 'Low') return 'status-low';
        return '';
    };

    // safe percent formatter: backend may return 0..1 or 0..100
    const formatLikelihoodPercent = (p) => {
        if (p === null || p === undefined) return '';
        const num = Number(p);
        if (!isFinite(num)) return '';
        if (num <= 1) return `(${(num * 100).toFixed(1)}%)`;
        return `(${num.toFixed(1)}%)`;
    };

    return (
        <div className="page-container">
            <header className="header">
                <h1>Savings Goals</h1>
                <Link to="/dashboard" className="back-link">Back to Dashboard</Link>
            </header>
            <div className="goals-grid">
                <div className="card">
                    <h3>Add a New Goal</h3>
                    <form onSubmit={handleSubmit} className="transaction-form-grid" style={{marginTop: '1rem'}}>
                        <div className="form-group full-width">
                            <label htmlFor="goalName">Goal Name</label>
                            <input id="goalName" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., New Laptop" required className="form-input" />
                        </div>

                        <div className="form-group">
                            <label htmlFor="goalAmount">Goal Amount (₹)</label>
                            <input id="goalAmount" type="number" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} placeholder="80000" required className="form-input" />
                        </div>

                        <div className="form-group">
                            <label htmlFor="targetDate">Target Date</label>
                            <input id="targetDate" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} required className="form-input" min={new Date().toISOString().slice(0,10)} />
                        </div>

                        <div className="form-group full-width">
                            <button type="submit" className="btn btn-primary">Set Goal</button>
                        </div>
                    </form>
                </div>

                {loading ? <div className="card"><p>Loading goals...</p></div> : goals.map(goal => {
                    const required = goal.required_monthly_savings ?? null;
                    const current = (goal.current_monthly_savings !== undefined && goal.current_monthly_savings !== null) ? Number(goal.current_monthly_savings) : 0;
                    const progressPercentage = (required && required > 0) ? Math.min(100, (current / required) * 100) : 0;
                    const likelihoodClass = getLikelihoodClass(goal.likelihood?.level);

                    // months remaining: try backend value, else compute locally
                    const monthsRemBackend = goal.months_remaining;
                    const monthsRemaining = monthsRemBackend ?? computeMonthsRemaining(goal.target_date);

                    return (
                        <div key={goal._id} className={`card goal-card ${likelihoodClass}`}>
                            <div className="goal-card-header">
                                <h3>{goal.name}</h3>
                                <button onClick={() => handleDelete(goal._id)} className="btn btn-danger">Delete</button>
                            </div>
                            
                            <p className="progress-info">Monthly Savings Progress:</p>
                            <div className="progress-container">
                                <div className={`progress-bar ${likelihoodClass}`} style={{ width: `${progressPercentage}%` }}></div>
                            </div>
                            
                            <div className="goal-card-details">
                                <p>Goal Amount: <strong>₹{Number(goal.goal_amount || 0).toLocaleString()}</strong></p>
                                <p>Target Date: <strong>{goal.target_date ? new Date(goal.target_date + 'T00:00:00').toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</strong></p>
                                <p>Required Rate: <strong>{required !== null ? formatCurrencySafe(required) : 'Target date passed / invalid'}</strong></p>
                                <p>Current Rate: <strong>{formatCurrencySafe(current)}</strong></p>
                            </div>

                            <div className={`recommendation-text ${likelihoodClass}`} style={{borderColor: ''}}>
                                <p><strong>Likelihood of Success: {goal.likelihood?.level || 'Unknown'} {goal.likelihood?.percentage ? formatLikelihoodPercent(goal.likelihood?.percentage) : ''}</strong></p>
                                <p>💡 {goal.advice}</p>

                                {/* show months remaining if available */}
                                <div style={{marginTop: '0.5rem', fontSize: '0.9em', color: 'var(--text-light)'}}>
                                    <p>Months remaining: <strong>{monthsRemaining ? monthsRemaining.toFixed(1) : '—'}</strong></p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default GoalsPage;
