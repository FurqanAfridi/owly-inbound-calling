import React, { useState } from 'react';
import { 
  ChevronRight, CreditCard, History, Database, User, Phone, Calendar, 
  Rocket, LayoutDashboard, Shield, Mic, Sparkles, Mail
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Documentation Sections ───────────────────────────────────────────────────

interface DocSection {
  id: string;
  title: string;
  content: string;
}

interface DocCategory {
  key: string;
  title: string;
  icon: React.ReactNode;
  sections: DocSection[];
}

const categories: DocCategory[] = [
  {
    key: 'quickstart',
    title: 'Getting Started',
    icon: <Rocket className="w-4 h-4" />,
    sections: [
      {
        id: 'sign-in',
        title: 'Sign In / Sign Up',
        content: `
          <h1>Getting Started</h1>
          <p>Welcome to the platform! This guide will walk you through creating your account and getting set up.</p>
          
          <h2>Sign In</h2>
          <p>If you already have an account, simply enter your credentials to access your dashboard.</p>
          <ol>
            <li>Navigate to the sign-in page</li>
            <li>Enter your registered email address</li>
            <li>Enter your password</li>
            <li>Click <strong>"Sign In"</strong> to access your account</li>
          </ol>
          
          <h2>Sign Up</h2>
          <p>New here? Create your account to start building AI-powered voice agents.</p>
          <ol>
            <li>Click on <strong>"Sign up"</strong> from the sign-in page</li>
            <li>Fill in your details:
              <ul>
                <li>First Name and Last Name</li>
                <li>Email Address (this will be your login)</li>
                <li>Phone Number (with country code)</li>
                <li>Password (minimum 8 characters, include at least one capital letter)</li>
                <li>Confirm Password</li>
              </ul>
            </li>
            <li>Agree to the Terms &amp; Privacy policy</li>
            <li>Click <strong>"Sign up"</strong> to create your account</li>
          </ol>
          
          <div class="tip-box">
            <strong>💡 Tip</strong>
            <p>Make sure to use a strong password to keep your account secure.</p>
          </div>
        `,
      },
    ],
  },
  {
    key: 'dashboard',
    title: 'Dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
    sections: [
      {
        id: 'dashboard-overview',
        title: 'Dashboard Overview',
        content: `
          <h1>Dashboard</h1>
          <p>Your central command center for monitoring call metrics, managing agents, and accessing all features.</p>
          
          <h2>Main Metrics</h2>
          <p>The dashboard displays real-time statistics about your voice agent performance:</p>
          <ul>
            <li><strong>Total Calls</strong> — Number of calls handled</li>
            <li><strong>Answered</strong> — Successfully answered calls</li>
            <li><strong>Missed</strong> — Calls that weren't answered</li>
            <li><strong>Avg Duration</strong> — Average call length</li>
            <li><strong>Forwarded</strong> — Calls transferred to another number</li>
            <li><strong>Answer Rate</strong> — Percentage of answered calls</li>
            <li><strong>Leads</strong> — Number of leads generated</li>
            <li><strong>Total Cost</strong> — Usage costs for the current period</li>
          </ul>
          
          <h2>Top Bar Features</h2>
          <ul>
            <li><strong>Credits Display</strong> — Shows your current credit balance and plan type</li>
            <li><strong>Search</strong> — Quickly find calls or specific information</li>
            <li><strong>Notifications</strong> — Stay updated on important events</li>
            <li><strong>Profile</strong> — Manage your account settings</li>
          </ul>
          
          <div class="tip-box">
            <strong>🎯 Quick Start</strong>
            <p>No voice agents yet? Click "Create Your First Agent" to get started.</p>
          </div>
        `,
      },
    ],
  },
  {
    key: 'phone-numbers',
    title: 'Phone Numbers',
    icon: <Phone className="w-4 h-4" />,
    sections: [
      {
        id: 'number-configuration',
        title: 'Import &amp; Configure',
        content: `
          <h1>Inbound Phone Numbers</h1>
          <p>Import and configure phone numbers to receive calls through your AI agents.</p>
          
          <h2>Adding a Number</h2>
          <p>The import wizard walks you through three simple steps:</p>
          
          <h3>Step 1 — Select Provider</h3>
          <p>Choose your telephony provider:</p>
          <ul>
            <li><strong>Twilio</strong> — Leading cloud communications platform</li>
            <li><strong>Vonage</strong> — Global communications provider</li>
            <li><strong>Telnyx</strong> — Developer-friendly telephony</li>
          </ul>
          
          <h3>Step 2 — Enter Phone Details</h3>
          <ul>
            <li><strong>Phone Number</strong> — The 10-digit number (e.g., 2345678900)</li>
            <li><strong>Label</strong> — A friendly name (e.g., "Main Office Line")</li>
            <li><strong>Call Forwarding Number</strong> (optional) — Fallback number for transfers</li>
          </ul>
          
          <h3>Step 3 — Provider Credentials</h3>
          <p>Enter your provider-specific credentials (Account SID, Auth Token, API Keys, etc.).</p>
          
          <h2>Number Status</h2>
          <ul>
            <li><strong>Active</strong> — Number is receiving calls</li>
            <li><strong>Activating</strong> — Number is being set up by the backend</li>
            <li><strong>Inactive</strong> — Number is paused</li>
          </ul>
          
          <h2>Credit Usage</h2>
          <p>Inbound calls use <strong>3 credits per minute</strong> of call duration.</p>
          
          <div class="warning-box">
            <strong>⚠️ Important</strong>
            <p>Keep your provider credentials secure. Never share Auth Tokens publicly.</p>
          </div>
        `,
      },
    ],
  },
  {
    key: 'knowledge-base',
    title: 'Knowledge Base',
    icon: <Database className="w-4 h-4" />,
    sections: [
      {
        id: 'create-knowledge',
        title: 'Creating &amp; Managing',
        content: `
          <h1>Knowledge Bases</h1>
          <p>A knowledge base is a collection of information, FAQs, and documents that your voice agents can reference during calls.</p>
          
          <h2>Creating a Knowledge Base</h2>
          <ol>
            <li>Go to <strong>Knowledge Base</strong> from the sidebar</li>
            <li>Click <strong>"Create Knowledge Base"</strong></li>
            <li>Enter a <strong>Name</strong> and <strong>Description</strong></li>
          </ol>
          
          <h2>Supported Content Types</h2>
          <ul>
            <li><strong>Text Content</strong> — Direct Q&amp;A pairs</li>
            <li><strong>Documents</strong> — PDF, DOCX files</li>
            <li><strong>Web Content</strong> — URLs to scrape</li>
            <li><strong>Structured Data</strong> — CSV files with Q&amp;A data</li>
          </ul>
          
          <h2>Assigning to Agents</h2>
          <p>When creating or editing an agent, select a knowledge base in the configuration step. The agent will reference it during calls to provide accurate answers.</p>
          
          <div class="tip-box">
            <strong>💡 Best Practices</strong>
            <ul>
              <li>Start with your most frequently asked questions</li>
              <li>Use clear, jargon-free language</li>
              <li>Update regularly based on customer feedback</li>
              <li>Create separate bases for different topics</li>
            </ul>
          </div>
          
          <div class="warning-box">
            <strong>⚠️ Note</strong>
            <p>Changes to a knowledge base affect all assigned agents immediately.</p>
          </div>
        `,
      },
    ],
  },
  {
    key: 'agents',
    title: 'Voice Agents',
    icon: <Mic className="w-4 h-4" />,
    sections: [
      {
        id: 'agent-creation',
        title: 'Creating Agents',
        content: `
          <h1>Create a Voice Agent</h1>
          <p>Configure an AI voice agent to handle inbound calls with natural-sounding conversations.</p>
          
          <h2>Basic Information</h2>
          <ul>
            <li><strong>Agent Name</strong> — e.g., "Sales Agent", "Support Agent"</li>
            <li><strong>Company Name</strong> — Your business name</li>
            <li><strong>Website URL</strong> — Company website for reference</li>
            <li><strong>Goal</strong> — Primary objective (e.g., "Book appointments", "Handle support")</li>
          </ul>
          
          <h2>Voice Selection</h2>
          <p>Choose from Deepgram or VAPI voices. You can preview each voice before selecting.</p>
          <ul>
            <li><strong>Deepgram</strong> — Amalthea, Aries, Apollo, Atlas, Cora, Cordelia, and more</li>
            <li><strong>VAPI</strong> — Arcas, Athena, Callista, Delia, and more</li>
          </ul>
          
          <div class="tip-box">
            <strong>🎙️ Voice Tips</strong>
            <ul>
              <li>Match voice tone to your brand personality</li>
              <li>Professional services often prefer calm, clear voices</li>
              <li>Sales may benefit from energetic voices</li>
            </ul>
          </div>
        `,
      },
      {
        id: 'agent-behavior',
        title: 'Agent Behavior',
        content: `
          <h1>Configure Agent Behavior</h1>
          <p>Fine-tune how your voice agent communicates and responds to callers.</p>
          
          <h2>Welcome Message</h2>
          <p>The first thing your agent says when answering:</p>
          <blockquote>"Hello! How can I help you today?"</blockquote>
          
          <h2>Instruction Voice</h2>
          <p>Describe the tone and style:</p>
          <blockquote>"Maintain a professional yet friendly tone. Be helpful and conversational."</blockquote>
          
          <h2>Script</h2>
          <p>Write or drag-and-drop a script that guides the conversation flow:</p>
          <pre><code>1. Greet the caller warmly
2. Ask how you can help
3. Listen actively to their needs
4. Provide relevant information
5. Offer to schedule a follow-up if needed
6. Thank them for calling</code></pre>
          
          <h2>Call Availability</h2>
          <ul>
            <li><strong>Start &amp; End Time</strong> — When calls are accepted</li>
            <li><strong>Available Days</strong> — Select weekdays/weekends</li>
          </ul>
          
          <div class="tip-box">
            <strong>⏰ Best Practice</strong>
            <p>Set availability times that match your business hours. Calls outside these times follow your fallback configuration.</p>
          </div>
        `,
      },
      {
        id: 'agent-settings',
        title: 'Advanced Settings',
        content: `
          <h1>Advanced Agent Settings</h1>
          <p>Fine-tune AI model parameters for optimal performance.</p>
          
          <h2>Language &amp; Timezone</h2>
          <ul>
            <li><strong>Language</strong> — Default: English</li>
            <li><strong>Timezone</strong> — For accurate scheduling and reporting</li>
          </ul>
          
          <h2>Agent Type</h2>
          <ul>
            <li><strong>Support</strong> — Customer service and help desk</li>
            <li><strong>Booking</strong> — Appointment scheduling</li>
            <li><strong>General</strong> — Multi-purpose agent</li>
          </ul>
          
          <h2>AI Model Parameters</h2>
          <table>
            <thead><tr><th>Parameter</th><th>Range</th><th>Recommended</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><strong>Temperature</strong></td><td>0.0–1.0</td><td>0.7</td><td>Controls response creativity</td></tr>
              <tr><td><strong>Confidence</strong></td><td>0.0–1.0</td><td>0.8</td><td>Minimum confidence before responding</td></tr>
              <tr><td><strong>Verbosity</strong></td><td>0.0–1.0</td><td>0.7</td><td>Controls response length</td></tr>
            </tbody>
          </table>
          
          <div class="tip-box">
            <strong>🎛️ Tuning Tips</strong>
            <ul>
              <li>Start with recommended values and adjust based on call performance</li>
              <li>Customer support typically needs higher confidence</li>
              <li>Creative applications may benefit from higher temperature</li>
            </ul>
          </div>
        `,
      },
      {
        id: 'fallback-knowledge',
        title: 'Fallback &amp; Knowledge',
        content: `
          <h1>Fallback &amp; Knowledge Base</h1>
          
          <h2>Fallback Configuration</h2>
          <p>Configure what happens when the agent can't handle a call:</p>
          <ul>
            <li>Agent is unavailable</li>
            <li>Call is outside business hours</li>
            <li>Complex query the agent can't handle</li>
            <li>Caller requests to speak with a human</li>
          </ul>
          <p>Enable a <strong>Fallback Number</strong> to forward calls to a human agent.</p>
          
          <h2>Knowledge Base Assignment</h2>
          <p>Select an existing knowledge base to give the agent access to your FAQs, documents, and product information.</p>
          
          <h2>Creating the Agent</h2>
          <p>Once configured, creating an agent costs <strong>5 credits</strong>. Review all settings before clicking <strong>"Create Agent"</strong>.</p>
          
          <div class="warning-box">
            <strong>⚠️ Before Creating</strong>
            <ul>
              <li>Review all configuration settings</li>
              <li>Test your welcome message wording</li>
              <li>Ensure fallback number is correct</li>
              <li>Verify assigned knowledge base</li>
            </ul>
          </div>
        `,
      },
    ],
  },
  {
    key: 'ai-prompt',
    title: 'AI Prompt',
    icon: <Sparkles className="w-4 h-4" />,
    sections: [
      {
        id: 'ai-prompt-overview',
        title: 'Prompt Generator',
        content: `
          <h1>AI Prompt Generator</h1>
          <p>Create optimized prompts for your voice agents using the built-in AI prompt generator.</p>
          
          <h2>How It Works</h2>
          <ol>
            <li><strong>Fill in your business details</strong> — company name, industry, services, etc.</li>
            <li><strong>Upload a document</strong> (optional) — The system can extract information from PDFs or DOCX files</li>
            <li><strong>Generate the prompt</strong> — The AI creates an optimized agent prompt based on your input</li>
            <li><strong>Save &amp; Assign</strong> — Save the prompt and use it when creating or editing agents</li>
          </ol>
          
          <h2>Configuration Fields</h2>
          <ul>
            <li><strong>Company Info</strong> — Name, address, website, phone, email</li>
            <li><strong>Business Details</strong> — Industry, description, target audience</li>
            <li><strong>Agent Purpose</strong> — What the agent should do</li>
            <li><strong>Services &amp; Pricing</strong> — Your offerings and rates</li>
            <li><strong>FAQs &amp; Objections</strong> — Common questions and how to handle them</li>
            <li><strong>Tone</strong> — Friendly, Professional, Casual, etc.</li>
          </ul>
          
          <p>Access the AI Prompt Generator from the <strong>Agents → AI Prompt</strong> tab.</p>
          
          <div class="tip-box">
            <strong>💡 Tip</strong>
            <p>The more details you provide, the better the generated prompt will be. Upload existing sales scripts or FAQ documents for best results.</p>
          </div>
        `,
      },
    ],
  },
  {
    key: 'scheduling',
    title: 'Schedules',
    icon: <Calendar className="w-4 h-4" />,
    sections: [
      {
        id: 'create-schedule',
        title: 'Creating Schedules',
        content: `
          <h1>Call Schedules</h1>
          <p>Create and manage call availability schedules for your agents.</p>
          
          <h2>Create a Schedule</h2>
          <ul>
            <li><strong>Schedule Name</strong> — e.g., "Business Hours", "Weekend Schedule"</li>
            <li><strong>Apply to Agent</strong> — All agents or select specific ones</li>
            <li><strong>Timezone</strong> — For accurate scheduling</li>
            <li><strong>Status</strong> — Active or Inactive</li>
          </ul>
          
          <div class="tip-box">
            <strong>📅 Best Practices</strong>
            <ul>
              <li>Create separate schedules for regular hours and special occasions</li>
              <li>Set different schedules for different agent types</li>
              <li>Remember to account for holidays and time off</li>
            </ul>
          </div>
        `,
      },
    ],
  },
  {
    key: 'email',
    title: 'Email Integration',
    icon: <Mail className="w-4 h-4" />,
    sections: [
      {
        id: 'email-setup',
        title: 'Email Setup',
        content: `
          <h1>Email Integration</h1>
          <p>Configure email notifications and templates for your voice agents.</p>
          
          <h2>Email Templates</h2>
          <p>Create and customize email templates that are sent automatically after calls:</p>
          <ul>
            <li><strong>Follow-up emails</strong> — Sent after calls to leads</li>
            <li><strong>Appointment confirmations</strong> — Sent after bookings</li>
            <li><strong>Summary emails</strong> — Call summaries sent to your team</li>
          </ul>
          
          <h2>Configuration</h2>
          <p>Set up your email integration with your preferred email provider and customize templates to match your brand.</p>
        `,
      },
    ],
  },
  {
    key: 'callHistory',
    title: 'Call History',
    icon: <History className="w-4 h-4" />,
    sections: [
      {
        id: 'view-history',
        title: 'Viewing Call History',
        content: `
          <h1>Call History</h1>
          <p>Review past calls, recordings, transcriptions, and lead information.</p>
          
          <h2>Metrics</h2>
          <ul>
            <li><strong>Total Calls</strong> — All calls received</li>
            <li><strong>Answered</strong> — Successfully handled calls</li>
            <li><strong>Missed</strong> — Calls not answered</li>
            <li><strong>Avg Duration</strong> — Average call length</li>
          </ul>
          
          <h2>Search &amp; Filter</h2>
          <ul>
            <li><strong>Search</strong> by phone number, agent name, or call ID</li>
            <li><strong>Filter by Time</strong> — Last 7 days, 30 days, 3 months, or custom range</li>
            <li><strong>Filter by Status</strong> — Answered, Missed, Forwarded</li>
            <li><strong>Filter by Agent</strong> — All or specific agent</li>
            <li><strong>Filter by Number</strong> — All or specific inbound number</li>
          </ul>
          
          <h2>Call Details</h2>
          <p>Click any call to view:</p>
          <ul>
            <li>Duration and timestamp</li>
            <li>Caller information</li>
            <li>Call recording and transcription</li>
            <li>Lead information captured</li>
          </ul>
          
          <div class="tip-box">
            <strong>📊 Tips</strong>
            <ul>
              <li>Review recordings to improve agent scripts</li>
              <li>Track missed call patterns to optimize availability</li>
              <li>Export data for detailed reporting</li>
            </ul>
          </div>
        `,
      },
    ],
  },
  {
    key: 'leads',
    title: 'Leads',
    icon: <Database className="w-4 h-4" />,
    sections: [
      {
        id: 'manage-leads',
        title: 'Managing Leads',
        content: `
          <h1>Leads Management</h1>
          <p>View and manage leads captured from your voice agent calls.</p>
          
          <h2>Lead Information</h2>
          <p>Each lead includes:</p>
          <ul>
            <li><strong>Contact Details</strong> — Name, phone, email</li>
            <li><strong>Source</strong> — Which agent and number captured the lead</li>
            <li><strong>Timestamp</strong> — When the lead was captured</li>
            <li><strong>Call Recording</strong> — Link to original call</li>
            <li><strong>Status</strong> — New, Contacted, Qualified, etc.</li>
          </ul>
          
          <h2>Export Leads</h2>
          <p>Export your leads in CSV or Excel format for use in CRM systems.</p>
          
          <div class="tip-box">
            <strong>🎯 Lead Tips</strong>
            <ul>
              <li>Set up automated follow-ups for new leads</li>
              <li>Track conversion rates by agent and number</li>
              <li>Regularly export and backup lead data</li>
            </ul>
          </div>
        `,
      },
    ],
  },
  {
    key: 'billing',
    title: 'Billing & Credits',
    icon: <CreditCard className="w-4 h-4" />,
    sections: [
      {
        id: 'credits-overview',
        title: 'Credits &amp; Pricing',
        content: `
          <h1>Billing &amp; Credits</h1>
          <p>Manage your credits, view usage, and upgrade your plan.</p>
          
          <h2>Credit Costs</h2>
          <table>
            <thead><tr><th>Action</th><th>Cost</th></tr></thead>
            <tbody>
              <tr><td>Create Voice Agent</td><td>5 credits</td></tr>
              <tr><td>Inbound Calls</td><td>3 credits / minute</td></tr>
            </tbody>
          </table>
          
          <h2>Pro Plan</h2>
          <p>Upgrade to unlock:</p>
          <ul>
            <li>Unlimited voice agents</li>
            <li>Priority support</li>
            <li>Advanced analytics</li>
            <li>Custom integrations</li>
            <li>White-label options</li>
          </ul>
          
          <h2>Purchase Credits</h2>
          <table>
            <thead><tr><th>Credits</th><th>Price</th><th>Savings</th></tr></thead>
            <tbody>
              <tr><td>100</td><td>$10</td><td>—</td></tr>
              <tr><td>500</td><td>$45</td><td>10%</td></tr>
              <tr><td>1,000</td><td>$80</td><td>20%</td></tr>
              <tr><td>5,000</td><td>$350</td><td>30%</td></tr>
            </tbody>
          </table>
          
          <div class="tip-box">
            <strong>💰 Cost Tips</strong>
            <ul>
              <li>Monitor credit usage regularly</li>
              <li>Set call duration limits to control costs</li>
              <li>Use schedules to prevent unnecessary calls</li>
            </ul>
          </div>
        `,
      },
    ],
  },
  {
    key: 'profile',
    title: 'Profile & Security',
    icon: <Shield className="w-4 h-4" />,
    sections: [
      {
        id: 'profile-customization',
        title: 'Profile',
        content: `
          <h1>Profile Management</h1>
          <p>Update your account details and personalize your experience.</p>
          
          <h2>Profile Picture</h2>
          <ul>
            <li>Supported formats: JPG, PNG, WebP, or GIF</li>
            <li>Maximum file size: 5 MB</li>
          </ul>
          
          <h2>Profile Information</h2>
          <ul>
            <li><strong>Email Address</strong> — Primary login (cannot be changed)</li>
            <li><strong>First Name</strong> — Editable</li>
          </ul>
        `,
      },
      {
        id: 'security',
        title: 'Security &amp; 2FA',
        content: `
          <h1>Security</h1>
          
          <h2>Password</h2>
          <ul>
            <li>Change your password regularly</li>
            <li>Use at least 8 characters with uppercase, numbers, and special characters</li>
          </ul>
          
          <h2>Two-Factor Authentication</h2>
          <p>Add an extra layer of security by enabling 2FA on your account.</p>
        `,
      },
      {
        id: 'verification',
        title: 'Verification &amp; KYC',
        content: `
          <h1>Account Verification</h1>
          <p>Verify your account to unlock full platform features.</p>
          
          <h2>Phone Verification</h2>
          <ol>
            <li>Enter your phone number with country code</li>
            <li>Click "Send Verification Code"</li>
            <li>Enter the 6-digit SMS code</li>
          </ol>
          
          <h2>KYC Verification</h2>
          <p>Upload a government-issued ID (Passport, Driver's License, or National ID) and a selfie holding the document.</p>
          
          <div class="tip-box">
            <strong>📸 Photo Tips</strong>
            <ul>
              <li>Ensure all text is clearly visible</li>
              <li>Use good lighting without glare</li>
              <li>Include all corners of the document</li>
            </ul>
          </div>
        `,
      },
      {
        id: 'account-management',
        title: 'Account Deletion',
        content: `
          <h1>Account Deactivation &amp; Deletion</h1>
          
          <h2>Deactivate Account</h2>
          <p>Schedules your account for deletion after 30 days. You can cancel anytime during this period.</p>
          
          <h2>Permanently Delete</h2>
          <div class="warning-box">
            <strong>⚠️ Warning</strong>
            <p>This action is <strong>irreversible</strong> and permanently removes all agents, call history, recordings, billing info, knowledge bases, and leads.</p>
          </div>
          <p>We recommend using deactivation instead, which gives you 30 days to change your mind.</p>
        `,
      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

const Documentation: React.FC = () => {
  const [activeCategoryKey, setActiveCategoryKey] = useState(categories[0].key);

  const activeCategory = categories.find(c => c.key === activeCategoryKey)!;

  const handleCategoryChange = (key: string) => {
    setActiveCategoryKey(key);
    // Scroll to top of content
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // For prev/next category navigation
  const currentCatIndex = categories.findIndex(c => c.key === activeCategoryKey);

  return (
    <div className="space-y-8" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Page Header */}
      <div>
        <h1 className="text-[28px] font-bold dark:text-[#f9fafb] text-[#27272b] leading-[36px] tracking-[-0.6px]">
          Documentation
        </h1>
        <p className="text-[16px] dark:text-[#818898] text-[#737373] mt-2 leading-relaxed">
          Learn how to use every feature of the platform.
        </p>
      </div>

      {/* Category Tabs — wrapping grid */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => handleCategoryChange(cat.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all duration-200',
              activeCategoryKey === cat.key
                ? 'bg-[#00c19c] text-white shadow-md'
                : 'dark:bg-[#1d212b] bg-[#f0f0f0] dark:text-[#818898] text-[#737373] hover:dark:text-white hover:text-[#27272b] hover:bg-[#e5e7eb] dark:hover:bg-[#2f3541]'
            )}
          >
            {cat.icon}
            <span>{cat.title}</span>
          </button>
        ))}
      </div>

      {/* Category Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#00c19c]/10 flex items-center justify-center text-[#00c19c]">
          {activeCategory.icon}
        </div>
        <div>
          <h2 className="text-[22px] font-bold dark:text-[#f9fafb] text-[#27272b]">
            {activeCategory.title}
          </h2>
          <p className="text-[13px] dark:text-[#818898] text-[#737373]">
            {activeCategory.sections.length} {activeCategory.sections.length === 1 ? 'section' : 'sections'}
          </p>
        </div>
      </div>

      {/* All Sections for this Category */}
      <div className="space-y-6">
        {activeCategory.sections.map((section, index) => (
          <div
            key={section.id}
            id={`section-${section.id}`}
            className="dark:bg-[#1d212b] bg-white border dark:border-[#2f3541] border-[#e5e7eb] rounded-[14px] overflow-hidden"
          >
            {/* Section header bar */}
            {activeCategory.sections.length > 1 && (
              <div className="flex items-center gap-3 px-8 py-4 border-b dark:border-[#2f3541] border-[#e5e7eb] dark:bg-[#181c24] bg-[#fafafa]">
                <div className="w-7 h-7 rounded-lg bg-[#00c19c]/10 flex items-center justify-center text-[#00c19c] text-[13px] font-bold">
                  {index + 1}
                </div>
                <h3
                  className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]"
                  dangerouslySetInnerHTML={{ __html: section.title }}
                />
              </div>
            )}

            {/* Section content */}
            <div className="px-8 py-8 lg:px-10 lg:py-10">
              <article
                className="doc-content max-w-none"
                dangerouslySetInnerHTML={{ __html: section.content }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Prev / Next Category Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => handleCategoryChange(categories[currentCatIndex - 1]?.key)}
          disabled={currentCatIndex <= 0}
          className={cn(
            'flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200',
            currentCatIndex <= 0
              ? 'text-[#a1a1aa]/40 cursor-not-allowed'
              : 'dark:text-[#818898] text-[#737373] hover:dark:text-white hover:text-[#27272b] dark:bg-[#1d212b] bg-[#f0f0f0] hover:bg-[#e5e7eb] dark:hover:bg-[#2f3541]'
          )}
        >
          <ChevronRight size={16} className="rotate-180" />
          <span>{currentCatIndex > 0 ? categories[currentCatIndex - 1].title : 'Previous'}</span>
        </button>
        <button
          onClick={() => handleCategoryChange(categories[currentCatIndex + 1]?.key)}
          disabled={currentCatIndex >= categories.length - 1}
          className={cn(
            'flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200',
            currentCatIndex >= categories.length - 1
              ? 'text-[#a1a1aa]/40 cursor-not-allowed'
              : 'dark:text-[#818898] text-[#737373] hover:dark:text-white hover:text-[#27272b] dark:bg-[#1d212b] bg-[#f0f0f0] hover:bg-[#e5e7eb] dark:hover:bg-[#2f3541]'
          )}
        >
          <span>{currentCatIndex < categories.length - 1 ? categories[currentCatIndex + 1].title : 'Next'}</span>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Inline Styles */}
      <style>{`
        /* ─── Article typography ───────────────────────────── */
        .doc-content h1 {
          font-size: 1.75rem;
          font-weight: 800;
          margin: 0 0 1.25rem 0;
          line-height: 1.3;
        }
        .doc-content h2 {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 2.5rem 0 1rem 0;
          padding-bottom: 0.625rem;
          line-height: 1.4;
        }
        .doc-content h3 {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 2rem 0 0.75rem 0;
          line-height: 1.4;
        }
        .doc-content h4 {
          font-size: 1rem;
          font-weight: 600;
          margin: 1.5rem 0 0.5rem 0;
        }
        .doc-content p {
          font-size: 0.95rem;
          line-height: 1.85;
          margin: 0 0 1rem 0;
        }
        .doc-content ul,
        .doc-content ol {
          margin: 0.75rem 0 1.25rem 1.5rem;
          padding: 0;
        }
        .doc-content li {
          font-size: 0.95rem;
          line-height: 1.85;
          margin-bottom: 0.4rem;
        }
        .doc-content ul { list-style-type: disc; }
        .doc-content ol { list-style-type: decimal; }
        .doc-content ul ul,
        .doc-content ol ul {
          margin: 0.35rem 0 0.5rem 1.25rem;
        }
        .doc-content strong {
          font-weight: 700;
        }

        /* Colors — light mode */
        .doc-content h1, .doc-content h2, .doc-content h3, .doc-content h4, .doc-content strong { color: #27272b; }
        .doc-content p, .doc-content li { color: #52525b; }
        .doc-content h2 { border-bottom: 1px solid #e5e7eb; }

        /* Colors — dark mode */
        .dark .doc-content h1, .dark .doc-content h2, .dark .doc-content h3, .dark .doc-content h4, .dark .doc-content strong { color: #f9fafb; }
        .dark .doc-content p, .dark .doc-content li { color: #a1a1aa; }
        .dark .doc-content h2 { border-bottom: 1px solid #2f3541; }

        /* Blockquote */
        .doc-content blockquote {
          border-left: 4px solid #00c19c;
          background: rgba(0, 193, 156, 0.05);
          padding: 0.75rem 1.25rem;
          margin: 1.25rem 0;
          border-radius: 0 0.75rem 0.75rem 0;
          font-style: normal;
        }
        .doc-content blockquote p {
          margin: 0;
        }

        /* Code */
        .doc-content code {
          font-size: 0.85rem;
          background: #f4f4f5;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
        }
        .dark .doc-content code {
          background: #2f3541;
        }
        .doc-content pre {
          background: #1e293b;
          color: #e2e8f0;
          padding: 1.25rem;
          border-radius: 0.75rem;
          overflow-x: auto;
          margin: 1.25rem 0;
          font-size: 0.85rem;
          line-height: 1.7;
        }
        .dark .doc-content pre {
          background: #0d1117;
        }
        .doc-content pre code {
          background: none;
          padding: 0;
          color: inherit;
        }

        /* Tables */
        .doc-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.25rem 0;
          font-size: 0.9rem;
          border-radius: 0.5rem;
          overflow: hidden;
        }
        .doc-content th {
          background: #f4f4f5;
          padding: 0.75rem 1rem;
          text-align: left;
          font-weight: 600;
          font-size: 0.85rem;
          color: #27272b;
        }
        .dark .doc-content th {
          background: #2f3541;
          color: #f9fafb;
        }
        .doc-content td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #e5e7eb;
          color: #52525b;
        }
        .dark .doc-content td {
          border-bottom-color: #2f3541;
          color: #a1a1aa;
        }

        /* Links */
        .doc-content a {
          color: #00c19c;
          text-decoration: none;
        }
        .doc-content a:hover {
          text-decoration: underline;
        }

        /* Tip / Warning boxes */
        .tip-box {
          background: linear-gradient(135deg, rgba(0, 193, 156, 0.06) 0%, rgba(0, 158, 128, 0.06) 100%);
          border-left: 4px solid #00c19c;
          padding: 1.25rem 1.5rem;
          margin: 2rem 0;
          border-radius: 0 0.75rem 0.75rem 0;
        }
        .tip-box > strong {
          color: #00c19c;
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
          letter-spacing: 0.02em;
        }
        .tip-box p {
          margin: 0 0 0.25rem 0;
          font-size: 0.9rem;
          line-height: 1.7;
        }
        .tip-box ul {
          margin: 0.5rem 0 0 1.25rem;
        }
        .tip-box li {
          font-size: 0.9rem;
          line-height: 1.7;
          margin-bottom: 0.2rem;
        }

        .warning-box {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.06) 0%, rgba(217, 119, 6, 0.06) 100%);
          border-left: 4px solid #f59e0b;
          padding: 1.25rem 1.5rem;
          margin: 2rem 0;
          border-radius: 0 0.75rem 0.75rem 0;
        }
        .warning-box > strong {
          color: #d97706;
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
          letter-spacing: 0.02em;
        }
        .warning-box p {
          margin: 0 0 0.25rem 0;
          font-size: 0.9rem;
          line-height: 1.7;
        }
        .warning-box ul {
          margin: 0.5rem 0 0 1.25rem;
        }
        .warning-box li {
          font-size: 0.9rem;
          line-height: 1.7;
          margin-bottom: 0.2rem;
        }
      `}</style>
    </div>
  );
};

export default Documentation;
