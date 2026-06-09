import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import './GroupsPage.css';

function GroupsPage() {
    const [groups, setGroups] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [loading, setLoading] = useState(true);
    const token = localStorage.getItem('token');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchGroups = async () => {
            setLoading(true);
            try {
                const config = { headers: { 'x-access-token': token } };
                const res = await axios.get('https://intellibudget.onrender.com/api/groups', config);
                setGroups(res.data);
            } catch (error) {
                console.error("Failed to fetch groups", error);
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchGroups();
        }
    }, [token]);

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!groupName) return alert("Please enter a group name.");
        
        try {
            const config = { headers: { 'x-access-token': token } };
            const res = await axios.post('https://intellibudget.onrender.com/api/groups', { name: groupName }, config);
            navigate(`/groups/${res.data.group_id}`);
        } catch (error) {
            alert("Failed to create group.");
            console.error(error);
        }
    };
    
    const handleDeleteGroup = async (groupId, groupName) => {
        if (window.confirm(`Are you sure you want to delete the group "${groupName}"? This will also delete all of its expenses.`)) {
            try {
                const config = { headers: { 'x-access-token': token } };
                await axios.delete(`https://intellibudget.onrender.com/api/groups/${groupId}`, config);
                setGroups(currentGroups => currentGroups.filter(g => g._id !== groupId));
            } catch (error) {
                alert(error.response?.data?.message || "Failed to delete group.");
                console.error(error);
            }
        }
    };

    return (
        <div className="page-container">
            <header className="header">
                <h1>Your Groups</h1>
                <Link to="/dashboard" className="back-link">Back to Dashboard</Link>
            </header>

            <div className="groups-grid">
                <div className="card create-group-card">
                    <h3>Create a New Group</h3>
                    <form onSubmit={handleCreateGroup} className="auth-form" style={{marginTop: '1rem'}}>
                        <div className="form-group">
                            <label htmlFor="groupName">Group Name</label>
                            {/* THIS IS THE CORRECTED LINE */}
                            <input id="groupName" type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g., Weekend Trip" required className="form-input"/>
                        </div>
                        <button type="submit" className="btn btn-primary">Create Group</button>
                    </form>
                </div>
                <div className="card all-groups-card">
                    <h3>All Groups</h3>
                    {loading ? ( <p>Loading groups...</p> ) : (
                        groups.length > 0 ? (
                            <ul className="groups-list">
                                {groups.map(group => (
                                    <li key={group._id} className="group-list-item-wrapper">
                                        <Link to={`/groups/${group._id}`} className="group-list-item">
                                            {group.name}
                                        </Link>
                                        <button onClick={() => handleDeleteGroup(group._id, group.name)} className="btn btn-danger">Delete</button>
                                    </li>
                                ))}
                            </ul>
                        ) : ( <p>You have no groups yet. Create one to get started!</p> )
                    )}
                </div>
            </div>
        </div>
    );
}

export default GroupsPage;