import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';
import characterImage from '../assest/success.png';
import { useThemeMode } from '../contexts/ThemeContext';

const Success: React.FC = () => {
  const navigate = useNavigate();
  const { setMode } = useThemeMode();

  // Force light mode on auth pages
  useEffect(() => {
    setMode('light');
  }, []);

  return (
    <div className="centered-container">
      <div className="centered-content">
        <div className="centered-image">
          <img src={characterImage} alt="Character" />
        </div>

        <div className="centered-form">
          <div className="form-container">
            <div className="success-icon">
              <svg viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>

            <h2 className="success-title">Password Updated!</h2>
            <p className="success-message">
              Your password has been changed successfully. You can continue using your<br />
              account with your new credentials.
            </p>

            <button 
              className="submit-button"
              onClick={() => navigate('/')}
            >
              Go to Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Success;
