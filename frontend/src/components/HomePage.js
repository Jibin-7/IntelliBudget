import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

function HomePage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('https://intellibudget.onrender.com/api/login', { email, password });
            localStorage.setItem('token', response.data.token);
            window.location.href = '/dashboard'; 
        } catch (error) {
            alert('Login Failed! Please check your credentials.');
            console.error(error);
        }
    };

    return (
        <div className="homepage-container">
            <div className="homepage-main">
                {/* --- Left Side: Website Info (No Change) --- */}
                <div className="info-section">
                    <h1>Intelligent Budgeting, Simplified.</h1>
                    <p>Take control of your finances with our smart, PGM-powered planner that helps you understand your spending and achieve your goals.</p>
                    <ul>
                        <li><span>📊</span> <strong>Smart Risk Analysis:</strong> Understand your spending habits and get predictions to stay on budget.</li>
                        <li><span>🎯</span> <strong>Goal Forecasting:</strong> Plan for future purchases and see your likelihood of success.</li>
                        <li><span>🤝</span> <strong>Easy Bill Splitting:</strong> Settle group expenses with a clear, simple breakdown of who owes whom.</li>
                    </ul>
                </div>

                {/* --- Right Side: Login Form (UPDATED) --- */}
                <div className="login-section">
                    <h2>Welcome Back</h2>
                    <form onSubmit={handleLogin} className="auth-form">
                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            {/* New wrapper for the icon and input */}
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
                            {/* New wrapper for the icon and input */}
                            <div className="input-group">
                                <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                                </svg>
                                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="form-input with-icon"/>
                            </div>
                        </div>
                        <button type="submit" className="btn btn-primary">
                            Login
                        </button>
                    </form>
                    <p style={{textAlign: 'center', marginTop: '1.5rem'}}>
                        Don't have an account? <Link to="/signup">Register Now</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default HomePage;