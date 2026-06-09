import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleSignup = async (e) => {
        e.preventDefault();
        try {
            await axios.post('https://intellibudget.onrender.com/api/signup', { email, password });
            alert('Signup successful! Please log in.');
            navigate('/login');
        } catch (error) {
            alert('Signup Failed! The email might already be in use.');
            console.error("Signup error:", error);
        }
    };

    return (
        <div className="card auth-container">
            <h2>Create Your Account</h2>
            <form onSubmit={handleSignup} className="auth-form">
                <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <div className="input-group">
                        <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
                            <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
                        </svg>
                        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="form-input with-icon"/>
                    </div>
                </div>
                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <div className="input-group">
                        <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                        </svg>
                        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="form-input with-icon" />
                    </div>
                </div>
                <button type="submit" className="btn btn-primary">Create Account</button>
            </form>
            <p>Already have an account? <Link to="/login">Log In</Link></p>
        </div>
    );
}

export default SignupPage;