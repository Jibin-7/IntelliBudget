import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link, useNavigate } from 'react-router-dom';
import './GroupDetailPage.css';

function GroupDetailPage() {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Form states
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');

    // State for editing the group name
    const [isEditing, setIsEditing] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    
    const token = localStorage.getItem('token');
    const currentUserId = token ? JSON.parse(atob(token.split('.')[1])).user_id : null;

    useEffect(() => {
        const fetchGroupDetails = async () => {
            setLoading(true);
            try {
                const config = { headers: { 'x-access-token': token } };
                const res = await axios.get(`https://intellibudget.onrender.com/api/groups/${groupId}`, config);
                setDetails(res.data);
                setNewGroupName(res.data.group.name); // Pre-fill edit state
            } catch (error) {
                console.error("Failed to fetch group details", error);
                setDetails(null);
            } finally {
                setLoading(false);
            }
        };

        if (groupId && token) {
            fetchGroupDetails();
        }
    }, [groupId, token]);

    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (!description || !amount || parseFloat(amount) <= 0) return alert("Please enter a valid description and amount.");
        
        try {
            const config = { headers: { 'x-access-token': token } };
            await axios.post(`https://intellibudget.onrender.com/api/groups/${groupId}/expenses`, { description, amount: parseFloat(amount) }, config);
            const res = await axios.get(`https://intellibudget.onrender.com/api/groups/${groupId}`, config); // Re-fetch
            setDetails(res.data);
            setDescription('');
            setAmount('');
        } catch (error) {
            alert("Failed to add expense.");
        }
    };
    
    const handleInvite = async (e) => {
        e.preventDefault();
        if (!inviteEmail) return alert("Please enter an email to invite.");
        try {
            const config = { headers: { 'x-access-token': token } };
            const res = await axios.post(`https://intellibudget.onrender.com/api/groups/${groupId}/members`, { email: inviteEmail }, config);
            alert(res.data.message);
            const updatedDetails = await axios.get(`https://intellibudget.onrender.com/api/groups/${groupId}`, config); // Re-fetch
            setDetails(updatedDetails.data);
            setInviteEmail('');
        } catch (error) {
            alert(error.response?.data?.message || "Failed to invite member.");
        }
    };

    const handleSaveName = async () => {
        try {
            const config = { headers: { 'x-access-token': token } };
            await axios.put(`https://intellibudget.onrender.com/api/groups/${groupId}`, { name: newGroupName }, config);
            setIsEditing(false);
            const res = await axios.get(`https://intellibudget.onrender.com/api/groups/${groupId}`, config); // Re-fetch
            setDetails(res.data);
        } catch (error) {
            alert(error.response?.data?.message || "Failed to update name.");
        }
    };

    const handleDeleteGroup = async () => {
        if (window.confirm(`Are you sure you want to delete the group "${details.group.name}"? This is permanent.`)) {
            try {
                const config = { headers: { 'x-access-token': token } };
                await axios.delete(`https://intellibudget.onrender.com/api/groups/${groupId}`, config);
                alert("Group deleted successfully.");
                navigate('/groups');
            } catch (error) {
                alert(error.response?.data?.message || "Failed to delete group.");
            }
        }
    };
    
    const getMemberEmail = (userId) => {
        const member = details?.members_details.find(m => m._id === userId);
        if (userId === currentUserId) return "You";
        return member ? member.email : 'Unknown Member';
    };

    if (loading) return <div className="page-container"><h2>Loading Group Details...</h2></div>;
    if (!details) return <div className="page-container"><h2>Group not found or failed to load.</h2></div>;

    return (
        <div className="page-container">
            <header className="header">
                {/* ... (Header with title/edit form remains the same) ... */}
                <div className="group-title-edit-area">
                    {isEditing ? (
                        <>
                            <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="form-input group-name-input"/>
                            <button onClick={handleSaveName} className="btn btn-primary">Save</button>
                            <button onClick={() => setIsEditing(false)} className="btn btn-secondary">Cancel</button>
                        </>
                    ) : (
                        <>
                            <h1>{details.group.name}</h1>
                            <button onClick={() => setIsEditing(true)} className="btn btn-secondary">Edit Name</button>
                        </>
                    )}
                </div>
                <Link to="/groups" className="back-link">Back to All Groups</Link>
            </header>

            {/* New Layout Container */}
            <div className="group-detail-layout">

                {/* --- Main Content Column (Left Side) --- */}
                <main className="main-content-col">
                    {/* Settle Up Section */}
                    <section className="group-section">
                        <h3>Settle Up</h3>
                        {details.simplified_debts.length > 0 ? (
                            <ul className="settle-up-list">
                                {details.simplified_debts.map((debt, index) => (
                                    <li key={index}>
                                        <div><span className="text-expense" style={{fontWeight: 'bold'}}>{getMemberEmail(debt.from)}</span> should pay <span className="text-income" style={{fontWeight: 'bold'}}>{getMemberEmail(debt.to)}</span></div>
                                        <strong>₹{debt.amount.toFixed(2)}</strong>
                                    </li>
                                ))}
                            </ul>
                        ) : ( <p style={{fontWeight: '500'}}>Everyone is settled up!</p> )}
                    </section>

                    {/* Expense History Section */}
                    <section className="group-section">
                        <h3>Expense History</h3>
                        {details.expenses.length > 0 ? (
                            <table className="transaction-table">
                                <thead><tr><th>Description</th><th>Amount</th><th>Paid By</th></tr></thead>
                                <tbody>{details.expenses.map(exp => ( <tr key={exp._id}><td>{exp.description}</td><td>₹{exp.amount.toFixed(2)}</td><td>{getMemberEmail(exp.paid_by_user_id.toString())}</td></tr> )).reverse()}</tbody>
                            </table>
                        ) : ( <p>No expenses have been added yet.</p> )}
                    </section>
                </main>

                {/* --- Sidebar Column (Right Side) --- */}
                <aside className="sidebar-col">
                    {/* Add Expense Section */}
                    <section className="group-section">
                        <h3>Add New Expense</h3>
                        <form onSubmit={handleAddExpense}>
                             <div className="form-group" style={{marginBottom: '1rem'}}>
                                <label htmlFor="description">Description</label>
                                <input id="description" type="text" value={description} onChange={(e) => setDescription(e.target.value)} required className="form-input" />
                            </div>
                            <div className="form-group" style={{marginBottom: '1.5rem'}}>
                                <label htmlFor="amount">Amount (₹)</label>
                                <input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required className="form-input" />
                            </div>
                            <div className="form-group">
                                <button type="submit" className="btn btn-primary">Add Expense</button>
                            </div>
                        </form>
                    </section>

                    {/* Members Section */}
                    <section className="group-section">
                        <h3>Members</h3>
                        <ul className="members-list">
                             {details.members_details.map(member => ( <li key={member._id}>{member.email} {member._id === currentUserId && <strong style={{color: 'var(--primary-color)'}}> (You)</strong>}</li> ))}
                        </ul>
                        <form onSubmit={handleInvite} className="invite-form">
                            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Invite by email" required className="form-input" />
                            <button type="submit" className="btn btn-secondary">Invite</button>
                        </form>
                    </section>
                </aside>
                
                {/* --- Danger Zone (Full Width Bottom) --- */}
                <section className="group-section danger-zone">
                    <h3>Danger Zone</h3>
                    <div className="danger-zone-content">
                        <p>Delete this group and all its expenses permanently.</p>
                        <button onClick={handleDeleteGroup} className="btn btn-danger">Delete Group</button>
                    </div>
                </section>

            </div>
        </div>
    );
}

export default GroupDetailPage;