import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TransactionForm.css'; // Import the new CSS file

function TransactionForm({ onTransactionAdded, transactionToEdit, onUpdateCancelled }) {
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [type, setType] = useState('expense');
    const [editingId, setEditingId] = useState(null);
    const token = localStorage.getItem('token');
    const [anomalyWarning, setAnomalyWarning] = useState('');

    useEffect(() => {
        if (transactionToEdit) {
            setAmount(transactionToEdit.amount);
            setCategory(transactionToEdit.category);
            setDate(transactionToEdit.date.slice(0, 10));
            setType(transactionToEdit.type);
            setEditingId(transactionToEdit._id);
            setAnomalyWarning('');
        }
    }, [transactionToEdit]);
    
    const clearForm = () => {
        setAmount('');
        setCategory('');
        setDate(new Date().toISOString().slice(0, 10));
        setType('expense');
        setEditingId(null);
        setAnomalyWarning('');
        if (onUpdateCancelled) onUpdateCancelled();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setAnomalyWarning('');
        if (!amount || !category || !date || parseFloat(amount) <= 0) {
            alert("Please fill all fields with valid data.");
            return;
        }

        const transactionData = { amount: parseFloat(amount), category, date, type };
        const config = { headers: { 'x-access-token': token } };

        try {
            if (editingId) {
                await axios.put(`https://intellibudget.onrender.com/api/transactions/${editingId}`, transactionData, config);
                alert('Transaction updated successfully!');
            } else {
                await axios.post('https://intellibudget.onrender.com/api/transactions', transactionData, config);
            }
            
            if (!editingId && type === 'expense') {
                const anomalyRes = await axios.post('https://intellibudget.onrender.com/api/check-anomaly', { amount: parseFloat(amount), category: category }, config);
                if (anomalyRes.data.is_anomaly) {
                    setAnomalyWarning(anomalyRes.data.message);
                } else {
                    alert('Transaction added successfully!');
                }
            } else if (!editingId && type === 'income') {
                 alert('Income added successfully!');
            }
            
            if(editingId) {
                clearForm();
            }
            onTransactionAdded();
        } catch (error) {
            alert('Failed to save transaction.');
            console.error(error);
        }
    };

return (
        <div>
            <h3>{editingId ? 'Edit Transaction' : 'Add New Transaction'}</h3>
            <form onSubmit={handleSubmit} className="transaction-form">
                {/* This grid now has a more balanced layout */}
                <div className="transaction-form-grid">

                    <div className="form-group full-width">
                        <label htmlFor="category">Category</label>
                        <input id="category" type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={type === 'expense' ? "e.g., Food, Transport" : "e.g., Salary"} required className="form-input" />
                    </div>

                    <div className="form-group">
                        <label htmlFor="amount">Amount (₹)</label>
                        <input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required className="form-input" />
                    </div>

                    <div className="form-group">
                        <label htmlFor="date">Date</label>
                        <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="form-input" />
                    </div>

                    <div className="form-group full-width">
                        <label htmlFor="type">Type</label>
                        <select id="type" value={type} onChange={(e) => setType(e.target.value)} className="form-select">
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                        </select>
                    </div>

                </div>

                <div className="form-buttons">
                    <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Add Transaction'}</button>
                    {editingId && <button type="button" onClick={clearForm} className="btn btn-secondary">Cancel</button>}
                </div>
            </form>
            
            {anomalyWarning && (
                <div className="anomaly-warning">
                    <strong>⚠️ Anomaly Detected</strong>
                    <p>{anomalyWarning}</p>
                </div>
            )}
        </div>
    );
}

export default TransactionForm;