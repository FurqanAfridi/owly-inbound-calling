import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Book, CreditCard, History, Database, User, Phone, Calendar, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

// Documentation data structure based on the PDF
const documentationData = {
  quickstart: {
    title: 'Quickstart',
    icon: Book,
    sections: [
      {
        id: 'sign-in',
        title: 'Sign In / Sign Up',
        content: `
          <h1>Getting Started with DNAI</h1>
          <p>Welcome to DNAI's creative HQ. Unlock the power of DNAI-driven social media intelligence to create, analyze, and dominate your social presence with cutting-edge tools.</p>
          
          <h2>Sign In</h2>
          <p>If you already have an account, simply enter your credentials to access your dashboard.</p>
          <ol>
            <li>Navigate to the sign-in page</li>
            <li>Enter your registered email address</li>
            <li>Enter your password</li>
            <li>Click "Sign In" to access your account</li>
          </ol>
          
          <h2>Sign Up</h2>
          <p>New to DNAI? Create your account to start building your DNAI-powered social growth engine.</p>
          <ol>
            <li>Click on "Sign up" from the sign-in page</li>
            <li>Fill in your details:
              <ul>
                <li>First Name and Last Name</li>
                <li>Email Address (this will be your login)</li>
                <li>Phone Number (with country code)</li>
                <li>Password (minimum 8 characters, include at least one capital letter)</li>
                <li>Confirm Password</li>
              </ul>
            </li>
            <li>Agree to the Terms & Privacy policy</li>
            <li>Click "Sign up" to create your account</li>
          </ol>
          
          <div class="tip-box">
            <strong>💡 Tip:</strong> Make sure to use a strong password to keep your account secure.
          </div>
        `
      }
    ]
  },
  dashboard: {
    title: 'Dashboard',
    icon: Users,
    sections: [
      {
        id: 'dashboard-overview',
        title: 'Dashboard Overview',
        content: `
          <h1>Dashboard</h1>
          <p>Your central command center for managing all DNAI operations, monitoring call metrics, and accessing key features.</p>
          
          <h2>Main Metrics</h2>
          <p>The dashboard displays real-time statistics about your voice agent performance:</p>
          <ul>
            <li><strong>Total Calls:</strong> Number of calls handled (all time)</li>
            <li><strong>Answered:</strong> Successfully answered calls (all time)</li>
            <li><strong>Missed:</strong> Calls that weren't answered (all time)</li>
            <li><strong>Avg Duration:</strong> Average call length (all time)</li>
            <li><strong>Forwarded:</strong> Calls transferred to another number (since forwarded)</li>
            <li><strong>Answer Rate:</strong> Percentage of answered calls (no calls yet)</li>
            <li><strong>Leads:</strong> Number of leads generated (no leads yet)</li>
            <li><strong>Total Cost:</strong> Usage costs for the current period</li>
          </ul>
          
          <h2>Navigation Menu</h2>
          <p>Access all key features from the sidebar:</p>
          <ul>
            <li><strong>Dashboard:</strong> Main overview (current page)</li>
            <li><strong>Voice Agents:</strong> Manage your AI voice agents</li>
            <li><strong>Inbound Numbers:</strong> Configure phone numbers</li>
            <li><strong>Knowledge Bases:</strong> Manage custom data and FAQs</li>
            <li><strong>Call Schedules:</strong> Set up call availability</li>
            <li><strong>Call History:</strong> Review past calls and recordings</li>
            <li><strong>Leads:</strong> View and manage captured leads</li>
          </ul>
          
          <h2>Top Bar Features</h2>
          <ul>
            <li><strong>Credits Display:</strong> Shows your current credit balance and plan type (Free)</li>
            <li><strong>Search:</strong> Quickly find calls or specific information</li>
            <li><strong>Settings:</strong> Access configuration options</li>
            <li><strong>Notifications:</strong> Stay updated on important events</li>
            <li><strong>Profile:</strong> Manage your account settings</li>
          </ul>
          
          <div class="tip-box">
            <strong>🎯 Quick Start:</strong> No voice agents yet? Click "Create Your First Agent" to get started with building your AI-powered call handling system.
          </div>
        `
      }
    ]
  },
  profile: {
    title: 'Profile & Settings',
    icon: User,
    sections: [
      {
        id: 'profile-customization',
        title: 'Profile',
        content: `
          <h1>Profile Management</h1>
          <p>Customize your account, manage security settings, and configure your DNAI experience.</p>
          
          <h2>Profile Picture</h2>
          <p>Upload a profile picture to personalize your account:</p>
          <ul>
            <li>Supported formats: JPG, PNG, WebP, or GIF</li>
            <li>Maximum file size: 5MB</li>
            <li>Click "Upload Picture" to select your image</li>
          </ul>
          
          <h2>Profile Information</h2>
          <p>View and update your account details:</p>
          <ul>
            <li><strong>Email Address:</strong> Your primary login email (cannot be changed)</li>
            <li><strong>First Name:</strong> Editable personal information</li>
            <li><strong>Other Details:</strong> Additional profile fields as needed</li>
          </ul>
          
          <p>Click the "Edit Profile" button to update your information.</p>
          
          <div class="warning-box">
            <strong>⚠️ Note:</strong> Email cannot be changed after signup for security reasons.
          </div>
        `
      },
      {
        id: 'security',
        title: 'Security',
        content: `
          <h1>Security & Verification</h1>
          <p>Enhance your account security and verify your identity.</p>
          
          <h2>Password Management</h2>
          <ul>
            <li>Change your password regularly for better security</li>
            <li>Use a strong password with at least 8 characters</li>
            <li>Include uppercase letters, numbers, and special characters</li>
          </ul>
          
          <h2>Two-Factor Authentication</h2>
          <p>Add an extra layer of security to your account by enabling 2FA.</p>
        `
      },
      {
        id: 'verification',
        title: 'Verification',
        content: `
          <h1>Account Verification</h1>
          <p>Verify your account to unlock unlimited DNAI agents and full platform features.</p>
          
          <h2>Phone Number Verification</h2>
          <p>Verify your phone number to enhance account security:</p>
          <ol>
            <li>Enter your phone number with country code</li>
            <li>Click "Send Verification Code"</li>
            <li>Enter the 6-digit code sent via SMS</li>
            <li>Complete verification</li>
          </ol>
          
          <h2>KYC Verification</h2>
          <p>Verify your identity by uploading government-issued documents:</p>
          
          <h3>Document Type</h3>
          <p>Select one of the following document types:</p>
          <ul>
            <li>Passport</li>
            <li>Driver's License</li>
            <li>National ID Card</li>
          </ul>
          
          <h3>Upload Requirements</h3>
          <ol>
            <li><strong>Document Front:</strong> Upload the front side of your document (JPG, PNG, or PDF, max 5MB)</li>
            <li><strong>Selfie Photo:</strong> Upload a clear selfie photo holding your document (JPG, PNG, or PDF, max 5MB)</li>
          </ol>
          
          <div class="tip-box">
            <strong>📸 Photo Tips:</strong>
            <ul>
              <li>Ensure all text is clearly visible and readable</li>
              <li>Use good lighting without glare or shadows</li>
              <li>Include all corners of the document</li>
              <li>Make sure your face is clearly visible in the selfie</li>
            </ul>
          </div>
        `
      },
      {
        id: 'account-management',
        title: 'Account Management',
        content: `
          <h1>Account Deactivation & Deletion</h1>
          <p>Manage your account status and deletion requests.</p>
          
          <h2>Deactivate Account</h2>
          <p>Deactivating your account will schedule it for deletion after 30 days.</p>
          <ul>
            <li>During this period, you can cancel the deactivation and restore your account</li>
            <li>After 30 days, your account and all associated data will be permanently deleted</li>
          </ul>
          <p>Click "Request Account Deactivation" to begin the process.</p>
          
          <h2>Permanently Delete Account</h2>
          <div class="warning-box">
            <strong>⚠️ Warning:</strong> This action is irreversible and cannot be undone!
          </div>
          <p>Permanently deleting your account will immediately and irrevocably remove:</p>
          <ul>
            <li>All voice agents</li>
            <li>Complete call history and recordings</li>
            <li>All billing information and transaction records</li>
            <li>Knowledge bases and custom data</li>
            <li>Lead information</li>
          </ul>
          <p>We recommend using the deactivation option instead, which gives you 30 days to change your mind.</p>
          <p>Click "Permanently Delete Account Now" only if you're absolutely certain.</p>
        `
      }
    ]
  },
  voiceAgents: {
    title: 'Voice Agents',
    icon: Phone,
    sections: [
      {
        id: 'agent-creation',
        title: 'Creating Voice Agents',
        content: `
          <h1>Create Voice Agent</h1>
          <p>Configure your DNAI voice agent to handle inbound calls with AI-powered conversations.</p>
          
          <h2>Basic Information</h2>
          
          <h3>Agent Name</h3>
          <p>Give your agent a descriptive name (e.g., "Sales Agent", "Support Agent", "Booking Agent").</p>
          
          <h3>Company Name</h3>
          <p>Enter your company name (e.g., "DNAI").</p>
          
          <h3>Website URL</h3>
          <p>Provide your company website URL for reference.</p>
          
          <h3>Goal</h3>
          <p>Define the primary objective for this agent. Examples:</p>
          <ul>
            <li>"Convert inquiries into booked appointments"</li>
            <li>"Handle customer support efficiently"</li>
            <li>"Qualify leads and gather contact information"</li>
            <li>"Schedule appointments and manage calendar"</li>
          </ul>
          
          <h3>Background Context</h3>
          <p>Describe your company's history, mission, or product. This helps the agent understand your brand and provide context about your business to keep it aligned with your values.</p>
          
          <h2>Voice Configuration</h2>
          
          <h3>Select Voice</h3>
          <p>Choose from Deepgram or VAPI voices. Options include:</p>
          
          <h4>Deepgram Voices</h4>
          <ul>
            <li><strong>Amalthea:</strong> Female - Engaging, Natural, Cheerful</li>
            <li><strong>Aries:</strong> Male - Warm, Energetic, Caring</li>
            <li><strong>Apollo:</strong> Male - Confident, Comfortable, Casual</li>
            <li><strong>Atlas:</strong> Male - Professional, Confident, Approachable</li>
            <li><strong>Cora:</strong> Female - Upbeat, Friendly, Caring</li>
            <li><strong>Cordelia:</strong> Female - Approachable, Warm, Professional</li>
            <li><strong>And many more...</strong></li>
          </ul>
          
          <h4>VAPI Voices</h4>
          <ul>
            <li><strong>Arcas:</strong> Male - Natural, Smooth, Clear, Comfortable</li>
            <li><strong>Athena:</strong> Female - Calm, Smooth, Professional</li>
            <li><strong>Callista:</strong> Female - Clear, Energetic, Professional, Smooth</li>
            <li><strong>Delia:</strong> Female - Natural, Friendly, Cheerful, Bubbly</li>
            <li><strong>And many more...</strong></li>
          </ul>
          
          <p>You can preview each voice before selection.</p>
          
          <div class="tip-box">
            <strong>🎙️ Voice Selection Tips:</strong>
            <ul>
              <li>Match voice tone to your brand personality</li>
              <li>Consider your target audience demographics</li>
              <li>Test different voices to find the best fit</li>
              <li>Professional services often prefer calm, clear voices</li>
              <li>Sales and marketing may benefit from energetic voices</li>
            </ul>
          </div>
        `
      },
      {
        id: 'agent-behavior',
        title: 'Agent Behavior',
        content: `
          <h1>Configure Agent Behavior</h1>
          <p>Fine-tune how your voice agent communicates and responds to callers.</p>
          
          <h2>Welcome Message</h2>
          <p>Set the first message your agent will say when answering a call. Example:</p>
          <blockquote>"Hello! How can I help you today?"</blockquote>
          
          <h2>Instruction Voice</h2>
          <p>Describe the voice tone and style for your agent. Example:</p>
          <blockquote>"Maintain a professional yet friendly tone. Be helpful and conversational."</blockquote>
          
          <h2>Script</h2>
          <p>Drag and drop or type your main script for the DNAI agent. This guides the conversation flow and helps the agent understand how to respond to different scenarios.</p>
          <p>Example script structure:</p>
          <pre><code>1. Greet the caller warmly
2. Ask how you can help
3. Listen actively to their needs
4. Provide relevant information
5. Offer to schedule a follow-up if needed
6. Thank them for calling</code></pre>
          
          <h2>Call Availability Time</h2>
          
          <h3>Start Time & End Time</h3>
          <p>Set when your agent is available to receive calls:</p>
          <ul>
            <li><strong>Start Time:</strong> When calls begin being received (e.g., 09:00 AM)</li>
            <li><strong>End Time:</strong> When calls stop being received (e.g., 05:00 PM)</li>
          </ul>
          
          <h3>Available Days</h3>
          <p>Select the days when the agent is available to receive calls:</p>
          <ul>
            <li>Monday</li>
            <li>Tuesday</li>
            <li>Wednesday</li>
            <li>Thursday</li>
            <li>Friday</li>
            <li>Saturday</li>
            <li>Sunday</li>
          </ul>
          
          <div class="tip-box">
            <strong>⏰ Best Practice:</strong> Set availability times that match your business hours. Calls received outside these times will follow your fallback configuration.
          </div>
        `
      },
      {
        id: 'agent-settings',
        title: 'Advanced Settings',
        content: `
          <h1>Advanced Agent Settings</h1>
          <p>Configure advanced parameters to optimize your agent's performance.</p>
          
          <h2>Phone Number Setup</h2>
          <p>No inbound numbers available yet? Click "Go to Inbound Numbers" to import or configure a number first.</p>
          
          <h2>Agent Settings</h2>
          
          <h3>Language</h3>
          <p>Select the language for your agent. Default: English</p>
          
          <h3>Timezone</h3>
          <p>Select your timezone for accurate call scheduling and reporting.</p>
          
          <h3>Agent Type</h3>
          <p>Choose the agent type based on its primary function:</p>
          <ul>
            <li><strong>Support:</strong> Customer service and help desk</li>
            <li><strong>Booking:</strong> Appointment scheduling and reservations</li>
            <li><strong>General:</strong> Multi-purpose conversational agent</li>
          </ul>
          
          <h3>Tool Integration</h3>
          <p>Select tools to enhance your agent's capabilities:</p>
          <ul>
            <li>SMS integration</li>
            <li>Email notifications</li>
            <li>CRM integration</li>
            <li>Calendar sync</li>
          </ul>
          
          <h2>AI Model Parameters</h2>
          
          <h3>Model Temperature (0.0 - 1.0)</h3>
          <p>Controls the randomness of the model's responses:</p>
          <ul>
            <li><strong>Lower values (0.0 - 0.3):</strong> More focused and deterministic responses</li>
            <li><strong>Medium values (0.4 - 0.7):</strong> Balanced creativity and consistency</li>
            <li><strong>Higher values (0.8 - 1.0):</strong> More creative and varied responses</li>
          </ul>
          <p><strong>Recommended:</strong> 0.7 (Balanced)</p>
          
          <h3>Confidence Level (0.0 - 1.0)</h3>
          <p>Controls how confident the agent should be before responding:</p>
          <ul>
            <li><strong>Lower values:</strong> Agent responds more freely but may be less accurate</li>
            <li><strong>Higher values:</strong> Agent only responds when highly confident, more decisive</li>
          </ul>
          <p><strong>Recommended:</strong> 0.80 (High confidence)</p>
          
          <h3>Verbosity Level (0.0 - 1.0)</h3>
          <p>Controls response length:</p>
          <ul>
            <li><strong>Lower values (0.0 - 0.3):</strong> Concise, brief responses</li>
            <li><strong>Medium values (0.4 - 0.7):</strong> Moderate detail</li>
            <li><strong>Higher values (0.8 - 1.0):</strong> Detailed, comprehensive responses</li>
          </ul>
          <p><strong>Recommended:</strong> 0.70 (Detailed)</p>
          
          <div class="tip-box">
            <strong>🎛️ Parameter Tuning:</strong>
            <ul>
              <li>Start with recommended values</li>
              <li>Adjust based on call performance</li>
              <li>Test changes with a few calls before full deployment</li>
              <li>Customer support typically needs higher confidence</li>
              <li>Creative applications may benefit from higher temperature</li>
            </ul>
          </div>
        `
      },
      {
        id: 'fallback-knowledge',
        title: 'Fallback & Knowledge',
        content: `
          <h1>Fallback Configuration & Knowledge Base</h1>
          <p>Set up backup options and provide custom information for your agent.</p>
          
          <h2>Fallback Configuration</h2>
          <p>Configure what happens when the agent can't handle a call or encounters an error.</p>
          
          <h3>Enable Fallback Number</h3>
          <p>Toggle this option to enable call forwarding to a human agent or backup number when needed.</p>
          
          <h3>Fallback Scenarios</h3>
          <ul>
            <li>Agent is unavailable</li>
            <li>Call is outside business hours</li>
            <li>Complex query the agent can't handle</li>
            <li>Caller requests to speak with a human</li>
            <li>Technical difficulties or errors</li>
          </ul>
          
          <h2>Knowledge Base Assignment</h2>
          <p>Assign a knowledge base to provide FAQs and documents to this agent.</p>
          
          <h3>Select Knowledge Base (Optional)</h3>
          <p>Choose from your existing knowledge bases or create a new one:</p>
          <ul>
            <li>None (agent uses only training and script)</li>
            <li>Select from existing knowledge bases</li>
            <li>Click "Manage knowledge bases" to create or edit</li>
          </ul>
          
          <p>Knowledge bases help your agent answer specific questions about your products, services, or policies.</p>
          
          <h2>Create Agent</h2>
          <p>Once you've configured all settings, review the credit cost:</p>
          <ul>
            <li><strong>Credit Cost:</strong> Creating this agent will use 5 credits</li>
          </ul>
          
          <p>Click "Create Agent" to finalize and deploy your voice agent.</p>
          
          <div class="warning-box">
            <strong>⚠️ Before Creating:</strong>
            <ul>
              <li>Review all configuration settings</li>
              <li>Test your welcome message wording</li>
              <li>Ensure fallback number is correct</li>
              <li>Verify assigned knowledge base is appropriate</li>
            </ul>
          </div>
        `
      }
    ]
  },
  inboundNumbers: {
    title: 'Inbound Numbers',
    icon: Phone,
    sections: [
      {
        id: 'number-configuration',
        title: 'Configure Inbound Numbers',
        content: `
          <h1>Inbound Number Configuration</h1>
          <p>Import and configure phone numbers to receive calls through your DNAI agents.</p>
          
          <h2>Add Inbound Number</h2>
          
          <h3>Provider Selection</h3>
          <p>Currently supported provider:</p>
          <ul>
            <li><strong>Twilio:</strong> Leading cloud communications platform</li>
          </ul>
          
          <h3>Phone Details</h3>
          
          <h4>Phone Number</h4>
          <p>Enter the complete phone number with country code (e.g., +1 234 567 8900).</p>
          <ul>
            <li>Include country code prefix</li>
            <li>10 digits for US numbers</li>
            <li>Format: +[country code] [number]</li>
          </ul>
          
          <h4>Label (Optional)</h4>
          <p>Add a friendly name to identify this number (e.g., "Main Office Line", "Sales Department", "Support Hotline").</p>
          
          <h3>Call Forwarding Configuration</h3>
          
          <h4>Call Forwarding Number</h4>
          <p>Enter the number to forward calls to when needed (e.g., +1 234 567 8901).</p>
          <ul>
            <li>Include country code</li>
            <li>SMS enabled: Receiving calls will not be forwarded to this number</li>
          </ul>
          
          <h4>Call Transfer Reason</h4>
          <p>Describe when and why calls should be transferred to the forwarding number. Examples:</p>
          <ul>
            <li>"Transfer calls when agent is unavailable"</li>
            <li>"Transfer after business hours"</li>
            <li>"Transfer for technical support"</li>
            <li>"Transfer when caller requests human agent"</li>
          </ul>
          
          <h3>Status</h3>
          <p>Set the number status:</p>
          <ul>
            <li><strong>Active:</strong> Number is receiving calls</li>
            <li><strong>Inactive:</strong> Number is not receiving calls</li>
          </ul>
          
          <h2>Provider Configuration (Twilio)</h2>
          
          <h3>Twilio Account SID</h3>
          <p>Enter your Twilio Account SID from your Twilio dashboard.</p>
          
          <h3>Twilio Auth Token</h3>
          <p>Enter your Twilio Auth Token for authentication.</p>
          
          <h3>Enable SMS</h3>
          <p>Toggle to enable SMS capabilities for this number.</p>
          
          <h2>Credit Usage</h2>
          <p><strong>Inbound calls will use 3 credits per minute</strong> of call duration.</p>
          
          <h2>Import Number</h2>
          <p>Once all information is entered, click "Import" to add the number to your account.</p>
          
          <div class="tip-box">
            <strong>📞 Getting Twilio Credentials:</strong>
            <ol>
              <li>Log in to your Twilio console</li>
              <li>Navigate to Account Dashboard</li>
              <li>Find your Account SID and Auth Token</li>
              <li>Copy and paste into DNAI configuration</li>
            </ol>
          </div>
          
          <div class="warning-box">
            <strong>⚠️ Important:</strong> Keep your Twilio credentials secure. Never share your Auth Token publicly.
          </div>
        `
      }
    ]
  },
  scheduling: {
    title: 'Call Schedules',
    icon: Calendar,
    sections: [
      {
        id: 'create-schedule',
        title: 'Creating Call Schedules',
        content: `
          <h1>Call Schedules</h1>
          <p>Create and manage call availability schedules for your agents.</p>
          
          <h2>Create Schedule</h2>
          
          <h3>Schedule Name</h3>
          <p>Enter a descriptive name for this schedule (e.g., "Business Hours", "Weekend Schedule", "Holiday Hours").</p>
          
          <h3>Apply to Agent (Optional)</h3>
          <p>Leave empty to apply to all agents, or select specific agents:</p>
          <ul>
            <li>None (applies to all agents)</li>
            <li>Select individual agents from the dropdown</li>
          </ul>
          
          <h3>Timezone</h3>
          <p>Select the timezone for this schedule. Example: Eastern Time (ET)</p>
          
          <h3>Status</h3>
          <p>Toggle to activate or deactivate the schedule:</p>
          <ul>
            <li><strong>Active:</strong> Schedule is in effect</li>
            <li><strong>Inactive:</strong> Schedule is disabled</li>
          </ul>
          
          <h2>Save Schedule</h2>
          <p>Click "Create" to save your call schedule configuration.</p>
          
          <div class="tip-box">
            <strong>📅 Schedule Best Practices:</strong>
            <ul>
              <li>Create separate schedules for regular hours and special occasions</li>
              <li>Set different schedules for different agent types</li>
              <li>Remember to account for holidays and time off</li>
              <li>Test new schedules before deploying to production</li>
            </ul>
          </div>
        `
      }
    ]
  },
  callHistory: {
    title: 'Call History',
    icon: History,
    sections: [
      {
        id: 'view-history',
        title: 'Viewing Call History',
        content: `
          <h1>Call History</h1>
          <p>View and manage your call history, recordings, and lead information.</p>
          
          <h2>Overview Metrics</h2>
          <p>Track your call performance with key metrics:</p>
          <ul>
            <li><strong>Total Calls:</strong> All calls received (compare to last month)</li>
            <li><strong>Answered:</strong> Successfully handled calls (compare to last month)</li>
            <li><strong>Missed:</strong> Calls not answered (compare to last month)</li>
            <li><strong>Avg Duration:</strong> Average call length (compare to last month)</li>
          </ul>
          
          <h2>Search and Filter</h2>
          
          <h3>Search Calls</h3>
          <p>Use the search bar to find specific calls by:</p>
          <ul>
            <li>Phone number</li>
            <li>Agent name</li>
            <li>Call ID</li>
          </ul>
          
          <h3>Filter Options</h3>
          <p>Refine your call list using multiple filters:</p>
          
          <h4>Time Period</h4>
          <ul>
            <li>Last 7 Days</li>
            <li>Last 30 Days</li>
            <li>Last 3 Months</li>
            <li>Custom date range</li>
          </ul>
          
          <h4>Status</h4>
          <ul>
            <li>All Status</li>
            <li>Answered</li>
            <li>Missed</li>
            <li>Forwarded</li>
          </ul>
          
          <h4>Agent</h4>
          <ul>
            <li>All Agents</li>
            <li>Individual agent selection</li>
          </ul>
          
          <h4>Phone Number</h4>
          <ul>
            <li>All Numbers</li>
            <li>Filter by specific inbound number</li>
          </ul>
          
          <h2>Call Details</h2>
          <p>Click on any call to view detailed information:</p>
          <ul>
            <li>Call duration and timestamp</li>
            <li>Caller information</li>
            <li>Agent that handled the call</li>
            <li>Call recording (if available)</li>
            <li>Transcription</li>
            <li>Lead information captured</li>
            <li>Call outcome</li>
          </ul>
          
          <div class="tip-box">
            <strong>📊 Analytics Tips:</strong>
            <ul>
              <li>Review call recordings to improve agent scripts</li>
              <li>Track missed call patterns to optimize availability</li>
              <li>Monitor average duration to gauge call efficiency</li>
              <li>Export data for detailed reporting</li>
            </ul>
          </div>
        `
      }
    ]
  },
  leads: {
    title: 'Leads',
    icon: Database,
    sections: [
      {
        id: 'manage-leads',
        title: 'Managing Leads',
        content: `
          <h1>Leads Management</h1>
          <p>View and manage leads captured from your call history.</p>
          
          <h2>Lead Overview</h2>
          <p>Track all leads generated through your voice agents in one centralized location.</p>
          
          <h2>Search Leads</h2>
          <p>Quickly find specific leads using the search function:</p>
          <ul>
            <li>Search by name</li>
            <li>Search by phone number</li>
            <li>Search by email</li>
            <li>Search by company</li>
          </ul>
          
          <h2>Filter Leads</h2>
          
          <h3>Time Period</h3>
          <ul>
            <li>Last 30 Days (default)</li>
            <li>Last 7 Days</li>
            <li>Last 3 Months</li>
            <li>All Time</li>
            <li>Custom date range</li>
          </ul>
          
          <h3>Agent Filter</h3>
          <ul>
            <li>All Agents</li>
            <li>Filter by specific agent</li>
          </ul>
          
          <h3>Phone Number Filter</h3>
          <ul>
            <li>All Numbers</li>
            <li>Filter by inbound number</li>
          </ul>
          
          <h2>Lead Information</h2>
          <p>Each lead entry contains:</p>
          <ul>
            <li><strong>Contact Details:</strong> Name, phone, email</li>
            <li><strong>Source:</strong> Which agent and number captured the lead</li>
            <li><strong>Timestamp:</strong> When the lead was captured</li>
            <li><strong>Call Recording:</strong> Link to original call</li>
            <li><strong>Notes:</strong> Any additional information captured</li>
            <li><strong>Status:</strong> New, Contacted, Qualified, etc.</li>
          </ul>
          
          <h2>Export Leads</h2>
          <p>Export your leads data for use in CRM systems or further analysis:</p>
          <ul>
            <li>CSV format</li>
            <li>Excel format</li>
            <li>Filtered or complete dataset</li>
          </ul>
          
          <div class="tip-box">
            <strong>🎯 Lead Management Tips:</strong>
            <ul>
              <li>Set up automated follow-ups for new leads</li>
              <li>Integrate with your CRM for seamless workflow</li>
              <li>Review lead quality to improve agent scripts</li>
              <li>Track conversion rates by agent and number</li>
              <li>Regularly export and backup lead data</li>
            </ul>
          </div>
        `
      }
    ]
  },
  knowledgeBase: {
    title: 'Knowledge Bases',
    icon: Database,
    sections: [
      {
        id: 'create-knowledge',
        title: 'Creating Knowledge Bases',
        content: `
          <h1>Knowledge Bases</h1>
          <p>Create and manage reusable knowledge bases for your agents to provide FAQs and documents.</p>
          
          <h2>What is a Knowledge Base?</h2>
          <p>A knowledge base is a collection of information, FAQs, and documents that your voice agents can reference during calls. This allows your agents to provide accurate, consistent answers to common questions.</p>
          
          <h2>Creating Your First Knowledge Base</h2>
          
          <h3>Click "Create Your First Knowledge Base"</h3>
          <p>If you don't have any knowledge bases yet, you'll see a prompt to create one.</p>
          
          <h3>Knowledge Base Configuration</h3>
          <ol>
            <li><strong>Name:</strong> Give your knowledge base a descriptive name (e.g., "Product FAQs", "Pricing Information", "Company Policies")</li>
            <li><strong>Description:</strong> Briefly describe what information this knowledge base contains</li>
            <li><strong>Category:</strong> Organize by category (optional)</li>
          </ol>
          
          <h2>Adding Content</h2>
          
          <h3>Supported Content Types</h3>
          <ul>
            <li><strong>Text Content:</strong> Direct Q&A pairs</li>
            <li><strong>Documents:</strong> PDF, DOCX files</li>
            <li><strong>Web Content:</strong> URLs to scrape information from</li>
            <li><strong>Structured Data:</strong> CSV files with Q&A data</li>
          </ul>
          
          <h3>Best Practices for Content</h3>
          <ul>
            <li>Write clear, concise answers</li>
            <li>Use natural language that matches how customers ask questions</li>
            <li>Include variations of common questions</li>
            <li>Keep information current and updated</li>
            <li>Organize related information together</li>
          </ul>
          
          <h2>Assigning to Agents</h2>
          <p>Once created, assign knowledge bases to specific agents:</p>
          <ul>
            <li>Go to Voice Agents settings</li>
            <li>Select the agent to edit</li>
            <li>Choose the knowledge base in the "Assign Knowledge Base" section</li>
            <li>Save changes</li>
          </ul>
          
          <h2>Managing Knowledge Bases</h2>
          
          <h3>Edit</h3>
          <p>Update content, add new Q&As, or remove outdated information.</p>
          
          <h3>Duplicate</h3>
          <p>Create a copy of an existing knowledge base to use as a template.</p>
          
          <h3>Delete</h3>
          <p>Remove knowledge bases that are no longer needed.</p>
          
          <div class="tip-box">
            <strong>💡 Knowledge Base Tips:</strong>
            <ul>
              <li>Start with your most frequently asked questions</li>
              <li>Review call transcripts to identify common queries</li>
              <li>Update regularly based on customer feedback</li>
              <li>Create separate knowledge bases for different topics</li>
              <li>Test your knowledge base with sample queries</li>
              <li>Use clear, jargon-free language</li>
            </ul>
          </div>
          
          <div class="warning-box">
            <strong>⚠️ Important:</strong>
            <ul>
              <li>Knowledge bases are shared across all agents assigned to them</li>
              <li>Changes to a knowledge base affect all associated agents immediately</li>
              <li>Large documents may take time to process</li>
            </ul>
          </div>
        `
      }
    ]
  },
  billing: {
    title: 'Billing & Credits',
    icon: CreditCard,
    sections: [
      {
        id: 'credits-overview',
        title: 'Credits & Pricing',
        content: `
          <h1>Billing & Credits</h1>
          <p>Manage your account credits, view usage, and upgrade your plan.</p>
          
          <h2>Current Plan</h2>
          <p>You're currently on the <strong>Free</strong> plan.</p>
          <ul>
            <li><strong>Current Balance:</strong> 180.00 credits</li>
            <li><strong>Plan Status:</strong> Free</li>
          </ul>
          
          <h2>Credit Usage</h2>
          
          <h3>Per-Action Costs</h3>
          <ul>
            <li><strong>Create Voice Agent:</strong> 5 credits per agent</li>
            <li><strong>Inbound Calls:</strong> 3 credits per minute of call duration</li>
            <li><strong>Knowledge Base Creation:</strong> Varies by size</li>
          </ul>
          
          <h2>Upgrade to Pro</h2>
          <p>Unlock unlimited DNAI agents and access premium features:</p>
          
          <h3>Pro Features</h3>
          <ul>
            <li>✅ Unlimited voice agents</li>
            <li>✅ Priority support</li>
            <li>✅ Advanced analytics</li>
            <li>✅ Custom integrations</li>
            <li>✅ Higher API limits</li>
            <li>✅ White-label options</li>
            <li>✅ Dedicated account manager</li>
          </ul>
          
          <p>Click "Upgrade Now" to unlock unlimited DNAI agents.</p>
          
          <h2>Purchase Additional Credits</h2>
          <p>Need more credits? Purchase additional credits for your account:</p>
          <ul>
            <li>100 credits - $10</li>
            <li>500 credits - $45 (10% savings)</li>
            <li>1,000 credits - $80 (20% savings)</li>
            <li>5,000 credits - $350 (30% savings)</li>
          </ul>
          
          <h2>Billing History</h2>
          <p>View your complete transaction and usage history:</p>
          <ul>
            <li>Credit purchases</li>
            <li>Credit usage by feature</li>
            <li>Monthly invoices</li>
            <li>Subscription renewals</li>
          </ul>
          
          <div class="tip-box">
            <strong>💰 Cost Optimization Tips:</strong>
            <ul>
              <li>Monitor your credit usage regularly</li>
              <li>Set call duration limits to control costs</li>
              <li>Use call schedules to prevent unnecessary calls</li>
              <li>Review agent performance to improve efficiency</li>
              <li>Consider Pro plan if creating many agents</li>
            </ul>
          </div>
        `
      }
    ]
  }
};

const UserManualDocs = () => {
  const [selectedSection, setSelectedSection] = useState('sign-in');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    quickstart: true,
    dashboard: true,
    profile: true,
    voiceAgents: true,
    inboundNumbers: true,
    scheduling: true,
    callHistory: true,
    leads: true,
    knowledgeBase: true,
    billing: true
  });


  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const getCurrentContent = () => {
    for (const category of Object.values(documentationData)) {
      const section = category.sections.find(s => s.id === selectedSection);
      if (section) return section.content;
    }
    return '';
  };

  const getCurrentTitle = () => {
    for (const category of Object.values(documentationData)) {
      const section = category.sections.find(s => s.id === selectedSection);
      if (section) return section.title;
    }
    return '';
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Documentation Menu */}
      <aside className="w-full lg:w-64 shrink-0">
        <div className="sticky top-24 space-y-1 bg-card rounded-xl border border-border p-3">
          {Object.entries(documentationData).map(([key, category]) => {
            const Icon = category.icon;
            const isExpanded = expandedCategories[key];
            return (
              <div key={key} className="space-y-1">
                <button
                  onClick={() => toggleCategory(key)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-foreground/70 hover:bg-accent/50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Icon size={16} />
                    <span>{category.title}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {isExpanded && (
                  <div className="ml-4 space-y-0.5 border-l border-border pl-2">
                    {category.sections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => setSelectedSection(section.id)}
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors",
                          selectedSection === section.id
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        )}
                      >
                        {section.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="bg-card rounded-2xl border border-border p-6 lg:p-10">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
            <span>Documentation</span>
            <ChevronRight size={14} />
            <span className="text-foreground font-medium">{getCurrentTitle()}</span>
          </div>

          {/* Content */}
          <article
            className="prose prose-slate dark:prose-invert max-w-none 
              prose-headings:font-bold prose-h1:text-3xl prose-h1:mb-6 prose-h1:mt-0 
              prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:pb-2
              prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3 
              prose-p:text-muted-foreground prose-p:leading-relaxed 
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline 
              prose-code:text-sm prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded 
              prose-pre:bg-slate-950 prose-pre:text-white prose-ul:list-disc prose-ol:list-decimal 
              prose-li:text-muted-foreground prose-strong:text-foreground 
              prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-primary/5 
              prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:not-italic"
            dangerouslySetInnerHTML={{ __html: getCurrentContent() }}
          />

          {/* Footer Navigation */}
          <div className="mt-16 pt-8 border-t border-border flex items-center justify-between">
            <button className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight size={16} className="rotate-180" />
              <span>Previous</span>
            </button>
            <button className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .tip-box {
          background: linear-gradient(135deg, rgba(0, 193, 156, 0.1) 0%, rgba(0, 158, 128, 0.1) 100%);
          border-left: 4px solid #00c19c;
          padding: 1.25rem;
          margin: 2rem 0;
          border-radius: 0.75rem;
        }
        
        .tip-box strong {
          color: #009e80;
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .tip-box ul {
          margin: 0.5rem 0 0 1.25rem;
        }
        
        .warning-box {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%);
          border-left: 4px solid #f59e0b;
          padding: 1.25rem;
          margin: 2rem 0;
          border-radius: 0.75rem;
        }
        
        .warning-box strong {
          color: #d97706;
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
      `}</style>
    </div>
  );
};

export default UserManualDocs;
