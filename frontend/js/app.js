/**
 * MailScout Pro - Executive & HR Cold Outreach Suite Frontend App
 */

// Application State
const state = {
    currentTab: 'single', // 'single', 'batch', 'verifier'
    activeFilter: 'all',  // 'all', 'HR', 'VP', 'DIRECTOR', 'C_SUITE', 'valid'
    searchQuery: '',
    selectedDomain: '',
    selectedCompany: '',
    isSearching: false,
    currentResults: null,
    
    // Batch processing
    batchCompanies: [],
    batchProgress: { current: 0, total: 0, active: false },
    batchResults: [],
    batchFilter: 'all',

    // Verifier tab
    verifierEmail: '',
    isVerifying: false,
    verifierResult: null,

    // Modals
    activeModal: null, // 'emailDraft', 'verifDetails', 'settings'
    selectedContactForDraft: null,
    selectedContactForDetails: null,
    
    // Settings (persisted in localStorage)
    settings: {
        hunterApiKey: localStorage.getItem('mailscout_hunter_key') || '',
        verifySmtp: localStorage.getItem('mailscout_verify_smtp') !== 'false'
    }
};

// Autocomplete debounce timer
let autocompleteTimer = null;

// Initialize on DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initAutocomplete();
    initFileUpload();
    initSettings();
    featherInit();
});

function featherInit() {
    if (window.lucide) {
        lucide.createIcons();
    }
}

// Toast notification helper
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;
    toast.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-sm font-medium transition-all duration-300 transform translate-y-0 opacity-100 ${
        type === 'error' ? 'bg-red-600 text-white' : 
        type === 'info' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'
    }`;

    setTimeout(() => {
        toast.className = 'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-sm font-medium transition-all duration-300 transform translate-y-12 opacity-0 pointer-events-none';
    }, 3200);
}

// Navigation between Single, Batch, and Verifier tabs
function initNavigation() {
    const tabSingle = document.getElementById('tab-btn-single');
    const tabBatch = document.getElementById('tab-btn-batch');
    const tabVerifier = document.getElementById('tab-btn-verifier');

    const viewSingle = document.getElementById('view-single');
    const viewBatch = document.getElementById('view-batch');
    const viewVerifier = document.getElementById('view-verifier');

    function switchTab(tab) {
        state.currentTab = tab;
        [tabSingle, tabBatch, tabVerifier].forEach(btn => btn?.classList.remove('bg-indigo-600', 'text-white'));
        [tabSingle, tabBatch, tabVerifier].forEach(btn => btn?.classList.add('text-slate-400', 'hover:text-slate-200'));

        viewSingle.classList.add('hidden');
        viewBatch.classList.add('hidden');
        viewVerifier.classList.add('hidden');

        if (tab === 'single') {
            tabSingle?.classList.add('bg-indigo-600', 'text-white');
            tabSingle?.classList.remove('text-slate-400');
            viewSingle.classList.remove('hidden');
        } else if (tab === 'batch') {
            tabBatch?.classList.add('bg-indigo-600', 'text-white');
            tabBatch?.classList.remove('text-slate-400');
            viewBatch.classList.remove('hidden');
        } else if (tab === 'verifier') {
            tabVerifier?.classList.add('bg-indigo-600', 'text-white');
            tabVerifier?.classList.remove('text-slate-400');
            viewVerifier.classList.remove('hidden');
        }
        featherInit();
    }

    tabSingle?.addEventListener('click', () => switchTab('single'));
    tabBatch?.addEventListener('click', () => switchTab('batch'));
    tabVerifier?.addEventListener('click', () => switchTab('verifier'));
}

// Autocomplete logic for company search
function initAutocomplete() {
    const input = document.getElementById('company-search-input');
    const dropdown = document.getElementById('autocomplete-dropdown');

    if (!input || !dropdown) return;

    input.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        state.searchQuery = val;
        clearTimeout(autocompleteTimer);

        if (val.length < 2) {
            dropdown.classList.add('hidden');
            dropdown.innerHTML = '';
            return;
        }

        autocompleteTimer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(val)}`);
                const data = await res.json();
                renderAutocompleteDropdown(data.suggestions || []);
            } catch (err) {
                console.error('Autocomplete fetch error:', err);
            }
        }, 220);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
}

function renderAutocompleteDropdown(suggestions) {
    const dropdown = document.getElementById('autocomplete-dropdown');
    const input = document.getElementById('company-search-input');
    if (!dropdown || !suggestions.length) {
        dropdown.classList.add('hidden');
        return;
    }

    dropdown.innerHTML = suggestions.map(item => `
        <div class="autocomplete-item flex items-center justify-between p-3 hover:bg-slate-800/80 cursor-pointer rounded-lg transition-colors" data-name="${item.name}" data-domain="${item.domain}">
            <div class="flex items-center gap-3">
                <img src="${item.logo}" alt="${item.name}" class="w-7 h-7 rounded object-contain bg-slate-800 p-0.5 border border-slate-700" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=312e81&color=fff'">
                <div>
                    <span class="font-semibold text-slate-100 text-sm">${item.name}</span>
                    <span class="text-xs text-slate-400 ml-2 font-mono">${item.domain}</span>
                </div>
            </div>
            <span class="text-xs text-indigo-400 flex items-center gap-1 font-medium">Select <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i></span>
        </div>
    `).join('');

    dropdown.classList.remove('hidden');
    featherInit();

    dropdown.querySelectorAll('.autocomplete-item').forEach(el => {
        el.addEventListener('click', () => {
            const name = el.getAttribute('data-name');
            const domain = el.getAttribute('data-domain');
            input.value = name;
            state.selectedCompany = name;
            state.selectedDomain = domain;
            dropdown.classList.add('hidden');
            performSingleSearch(name, domain);
        });
    });
}

// Quick Pills Trigger
window.quickSearch = function(name, domain) {
    const input = document.getElementById('company-search-input');
    if (input) input.value = name;
    state.selectedCompany = name;
    state.selectedDomain = domain;
    performSingleSearch(name, domain);
};

// Single Search Execution
async function performSingleSearch(company, domain = '') {
    const searchBtn = document.getElementById('search-btn');
    const searchLoader = document.getElementById('search-loader');
    const searchIcon = document.getElementById('search-icon');
    const resultsContainer = document.getElementById('single-results-container');
    const emptyState = document.getElementById('single-empty-state');

    company = company || document.getElementById('company-search-input')?.value.trim();
    if (!company) {
        showToast('Please enter a company name or domain.', 'error');
        return;
    }

    state.isSearching = true;
    searchBtn.disabled = true;
    searchLoader?.classList.remove('hidden');
    searchIcon?.classList.add('hidden');

    try {
        const payload = {
            company: company,
            domain: domain || undefined,
            hunter_api_key: state.settings.hunterApiKey || null,
            verify_smtp: state.settings.verifySmtp
        };

        const res = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || 'Failed to search company');
        }

        const data = await res.json();
        state.currentResults = data;
        state.activeFilter = 'all';

        emptyState?.classList.add('hidden');
        resultsContainer?.classList.remove('hidden');
        renderSingleResults(data);
        showToast(`Discovered ${data.total_contacts} contacts for ${data.company}!`);
    } catch (err) {
        console.error('Search failed:', err);
        showToast(err.message || 'Error fetching company leads.', 'error');
    } finally {
        state.isSearching = false;
        searchBtn.disabled = false;
        searchLoader?.classList.add('hidden');
        searchIcon?.classList.remove('hidden');
        featherInit();
    }
}

// Render Single Company Results
function renderSingleResults(data) {
    const logoImg = document.getElementById('res-company-logo');
    const nameEl = document.getElementById('res-company-name');
    const domainEl = document.getElementById('res-company-domain');
    const totalBadge = document.getElementById('res-total-badge');
    const validBadge = document.getElementById('res-valid-badge');
    const riskyBadge = document.getElementById('res-risky-badge');

    if (logoImg) {
        logoImg.src = data.logo || `https://logo.clearbit.com/${data.domain}`;
        logoImg.onerror = () => {
            logoImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.company)}&background=4338ca&color=fff`;
        };
    }
    if (nameEl) nameEl.textContent = data.company;
    if (domainEl) {
        domainEl.textContent = data.domain;
        domainEl.href = `https://${data.domain}`;
    }

    if (totalBadge) totalBadge.textContent = `${data.total_contacts} Contacts Found`;
    if (validBadge) validBadge.textContent = `${data.valid_count} Deliverable`;
    if (riskyBadge) riskyBadge.textContent = `${data.risky_count} Catch-All / Risky`;

    renderContactCards();
}

// Filter contacts
window.filterContacts = function(filterCategory) {
    state.activeFilter = filterCategory;
    document.querySelectorAll('.filter-tab-btn').forEach(btn => {
        btn.classList.remove('bg-indigo-600', 'text-white', 'border-indigo-500');
        btn.classList.add('text-slate-400', 'border-slate-800');
    });
    const activeBtn = document.getElementById(`filter-btn-${filterCategory}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-indigo-600', 'text-white', 'border-indigo-500');
        activeBtn.classList.remove('text-slate-400', 'border-slate-800');
    }
    renderContactCards();
};

function renderContactCards() {
    const container = document.getElementById('contacts-grid');
    if (!container || !state.currentResults) return;

    let filtered = state.currentResults.contacts || [];
    if (state.activeFilter === 'HR') {
        filtered = filtered.filter(c => c.category === 'HR');
    } else if (state.activeFilter === 'VP') {
        filtered = filtered.filter(c => c.category === 'VP');
    } else if (state.activeFilter === 'DIRECTOR') {
        filtered = filtered.filter(c => c.category === 'DIRECTOR');
    } else if (state.activeFilter === 'C_SUITE') {
        filtered = filtered.filter(c => c.category === 'C_SUITE');
    } else if (state.activeFilter === 'valid') {
        filtered = filtered.filter(c => c.verification.status === 'valid' || c.verification.status === 'role_based');
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-12 text-center text-slate-400">
                <i data-lucide="filter" class="w-10 h-10 mx-auto text-slate-600 mb-3"></i>
                <p class="text-base font-medium">No contacts match the selected filter.</p>
            </div>
        `;
        featherInit();
        return;
    }

    container.innerHTML = filtered.map((c, index) => {
        const verif = c.verification;
        let badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        let badgeIcon = 'check-circle';
        let badgeLabel = `Valid (${verif.score}%)`;

        if (verif.status === 'risky') {
            badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            badgeIcon = 'alert-triangle';
            badgeLabel = `Catch-All (${verif.score}%)`;
        } else if (verif.status === 'role_based') {
            badgeClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            badgeIcon = 'inbox';
            badgeLabel = `Team Inbox (${verif.score}%)`;
        } else if (verif.status === 'invalid') {
            badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            badgeIcon = 'x-circle';
            badgeLabel = 'Invalid Mailbox';
        }

        let catBadge = 'bg-purple-900/40 text-purple-300 border-purple-700/50';
        if (c.category === 'HR') catBadge = 'bg-indigo-900/40 text-indigo-300 border-indigo-700/50';
        if (c.category === 'DIRECTOR') catBadge = 'bg-teal-900/40 text-teal-300 border-teal-700/50';
        if (c.category === 'C_SUITE') catBadge = 'bg-amber-900/40 text-amber-300 border-amber-700/50';

        return `
            <div class="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all">
                <div>
                    <!-- Header with Role and Status -->
                    <div class="flex items-center justify-between gap-2 mb-3">
                        <span class="px-2.5 py-1 text-xs font-semibold rounded-md border ${catBadge}">
                            ${c.category.replace('_', '-')}
                        </span>
                        <button onclick="inspectVerificationDetails('${c.email}')" class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border ${badgeClass} hover:opacity-80 transition cursor-pointer" title="Click to view full DNS & SMTP inspection">
                            <i data-lucide="${badgeIcon}" class="w-3.5 h-3.5"></i>
                            ${badgeLabel}
                        </button>
                    </div>

                    <!-- Contact Name & Title -->
                    <h3 class="text-base font-bold text-slate-100 flex items-center gap-2">
                        ${c.name}
                    </h3>
                    <p class="text-xs text-indigo-400 font-medium mb-4">${c.title}</p>

                    <!-- Email Box -->
                    <div class="bg-slate-900/90 rounded-xl p-3 border border-slate-800/80 flex items-center justify-between gap-2 mb-4">
                        <div class="truncate">
                            <span class="text-xs text-slate-400 block mb-0.5">Verified Email</span>
                            <span class="text-sm font-mono font-medium text-slate-200 select-all">${c.email}</span>
                        </div>
                        <button onclick="copyToClipboard('${c.email}', 'Email copied!')" class="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition" title="Copy Email">
                            <i data-lucide="copy" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                    <button onclick="openColdEmailModal('${c.email}')" class="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-semibold py-2.5 px-3 rounded-xl transition shadow-lg shadow-indigo-600/20">
                        <i data-lucide="mail" class="w-3.5 h-3.5"></i>
                        Cold Mail Pitch
                    </button>
                    <a href="${c.cold_email.gmail_url}" target="_blank" class="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition border border-slate-700" title="Open directly in Gmail">
                        <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                    </a>
                </div>
            </div>
        `;
    }).join('');

    featherInit();
}

// Copy to Clipboard Utility
window.copyToClipboard = function(text, successMsg = 'Copied!') {
    navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg);
    }).catch(err => {
        console.error('Clipboard copy failed:', err);
    });
};

// Copy all verified emails for batch BCC
window.copyAllVerifiedEmails = function() {
    if (!state.currentResults || !state.currentResults.contacts) return;
    const validEmails = state.currentResults.contacts
        .filter(c => c.verification.status === 'valid' || c.verification.status === 'role_based')
        .map(c => c.email);
    
    if (validEmails.length === 0) {
        showToast('No valid emails to copy.', 'error');
        return;
    }
    copyToClipboard(validEmails.join(', '), `Copied ${validEmails.length} emails to clipboard!`);
};

// Export Handlers
window.exportLeads = async function(format) {
    if (!state.currentResults || !state.currentResults.contacts) {
        showToast('No leads available to export.', 'error');
        return;
    }

    try {
        const payload = {
            format: format,
            company_name: state.currentResults.company,
            leads: state.currentResults.contacts
        };

        const res = await fetch('/api/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Export failed');

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mailscout_${state.currentResults.company.toLowerCase()}_leads.${format === 'excel' ? 'xlsx' : 'csv'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showToast(`Exported leads to ${format.toUpperCase()}!`);
    } catch (err) {
        console.error('Export error:', err);
        showToast('Failed to export leads.', 'error');
    }
};

// Inspect Verification Diagnostics Modal
window.inspectVerificationDetails = function(email) {
    if (!state.currentResults) return;
    const contact = state.currentResults.contacts.find(c => c.email === email);
    if (!contact) return;

    const modal = document.getElementById('verif-modal');
    const content = document.getElementById('verif-modal-content');
    const v = contact.verification;

    content.innerHTML = `
        <div class="space-y-4">
            <div class="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div class="text-xs text-slate-400 font-mono mb-1">Target Email</div>
                <div class="text-base font-mono font-bold text-slate-100">${v.email}</div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div class="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                    <div class="text-xs text-slate-400 mb-1">RFC Syntax Check</div>
                    <span class="inline-flex items-center gap-1.5 text-xs font-semibold ${v.is_valid_format ? 'text-emerald-400' : 'text-rose-400'}">
                        <i data-lucide="${v.is_valid_format ? 'check' : 'x'}" class="w-3.5 h-3.5"></i>
                        ${v.is_valid_format ? 'Valid RFC 5322' : 'Invalid Syntax'}
                    </span>
                </div>
                <div class="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                    <div class="text-xs text-slate-400 mb-1">Burner / Disposable</div>
                    <span class="inline-flex items-center gap-1.5 text-xs font-semibold ${!v.is_disposable ? 'text-emerald-400' : 'text-rose-400'}">
                        <i data-lucide="${!v.is_disposable ? 'shield-check' : 'alert-triangle'}" class="w-3.5 h-3.5"></i>
                        ${!v.is_disposable ? 'Clean (Not Disposable)' : 'Disposable Domain'}
                    </span>
                </div>
                <div class="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                    <div class="text-xs text-slate-400 mb-1">DNS Mail Server (MX)</div>
                    <div class="text-xs font-mono font-medium text-slate-200 truncate" title="${v.mx_host || 'None'}">
                        ${v.mx_host || 'No MX Record'}
                    </div>
                </div>
                <div class="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                    <div class="text-xs text-slate-400 mb-1">Catch-All Policy</div>
                    <span class="inline-flex items-center gap-1.5 text-xs font-semibold ${v.is_catch_all ? 'text-amber-400' : 'text-emerald-400'}">
                        <i data-lucide="${v.is_catch_all ? 'alert-circle' : 'check'}" class="w-3.5 h-3.5"></i>
                        ${v.is_catch_all ? 'Accept-All (Catch-All)' : 'Dedicated Mailbox'}
                    </span>
                </div>
            </div>

            <div class="p-4 bg-slate-900/80 rounded-xl border border-slate-800">
                <div class="text-xs text-slate-400 mb-1 font-semibold">Live Deliverability Assessment</div>
                <p class="text-sm text-slate-200">${v.recommendation}</p>
                ${v.smtp_details ? `<div class="mt-2 text-xs font-mono text-indigo-400 bg-indigo-950/40 p-2 rounded border border-indigo-900/50">${v.smtp_details}</div>` : ''}
            </div>

            <div class="flex items-center justify-between p-4 bg-slate-800/40 rounded-xl border border-slate-700/60">
                <span class="text-sm font-semibold text-slate-300">Overall Deliverability Confidence</span>
                <span class="text-lg font-bold ${v.score >= 80 ? 'text-emerald-400' : v.score >= 50 ? 'text-amber-400' : 'text-rose-400'}">${v.score}%</span>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    featherInit();
};

window.closeVerifModal = function() {
    document.getElementById('verif-modal')?.classList.add('hidden');
};

// Cold Email Modal Logic
window.openColdEmailModal = function(email) {
    if (!state.currentResults) return;
    const contact = state.currentResults.contacts.find(c => c.email === email);
    if (!contact) return;

    state.selectedContactForDraft = contact;
    const modal = document.getElementById('cold-email-modal');
    const toInput = document.getElementById('draft-to-email');
    const subjectInput = document.getElementById('draft-subject');
    const bodyInput = document.getElementById('draft-body');
    const roleBadge = document.getElementById('draft-role-badge');
    const templateSelect = document.getElementById('draft-template-select');

    if (toInput) toInput.value = contact.email;
    if (roleBadge) roleBadge.textContent = `${contact.name} (${contact.title})`;

    // Set default template matching category
    if (templateSelect) {
        if (contact.category === 'HR') templateSelect.value = 'hr';
        else if (contact.category === 'VP') templateSelect.value = 'vp';
        else if (contact.category === 'DIRECTOR') templateSelect.value = 'director';
        else templateSelect.value = 'csuite';
    }

    if (subjectInput) subjectInput.value = contact.cold_email.subject;
    if (bodyInput) bodyInput.value = contact.cold_email.body;

    modal.classList.remove('hidden');
    featherInit();
};

window.onTemplateChanged = function() {
    const select = document.getElementById('draft-template-select');
    const subjectInput = document.getElementById('draft-subject');
    const bodyInput = document.getElementById('draft-body');
    const c = state.selectedContactForDraft;
    if (!c || !select) return;

    const val = select.value;
    const company = state.currentResults?.company || 'Company';
    const salutation = `Hi ${c.name.split(' ')[0]},`;

    if (val === 'hr') {
        subjectInput.value = `Inquiry regarding open opportunities / Talent team at ${company}`;
        bodyInput.value = `${salutation}\n\nI hope you're having a productive week.\n\nI've been following ${company}'s recent work and impressive growth in the industry. As someone with experience delivering strong results in dynamic environments, I wanted to reach out directly to express my strong interest in joining your team.\n\nCould you let me know if the ${c.title} team or hiring managers are open to reviewing a portfolio/resume for upcoming opportunities?\n\nI would be glad to share my background or schedule a brief 10-minute introductory conversation.\n\nThank you for your time,\n[Your Name]\n[Your Portfolio / LinkedIn / Phone]`;
    } else if (val === 'vp') {
        subjectInput.value = `Quick question regarding ${company}'s current initiatives`;
        bodyInput.value = `${salutation}\n\nI hope this note finds you well.\n\nI am reaching out to you directly because of your leadership as ${c.title} at ${company}. We specialize in helping forward-thinking teams streamline execution and drive measurable business impact without increasing overhead.\n\nI would love to share a 2-minute insight on how similar organizations in your space are achieving 30%+ efficiency gains.\n\nDo you have 10 minutes next Tuesday or Wednesday for a brief introductory call?\n\nBest regards,\n[Your Name]\n[Your Title & Contact]`;
    } else if (val === 'director') {
        subjectInput.value = `Workflow optimization & Collaboration for ${company}`;
        bodyInput.value = `${salutation}\n\nI hope you are doing well.\n\nGiven your responsibility as ${c.title} at ${company}, I wanted to introduce a high-impact solution designed to accelerate workflow throughput and reduce operational bottlenecks.\n\nI'd love to share a short overview of how this can support your current quarterly goals.\n\nWould you be open to a quick 10-minute discussion this week?\n\nWarm regards,\n[Your Name]\n[Your Contact Info]`;
    } else {
        subjectInput.value = `Quick question for ${c.name}`;
        bodyInput.value = `${salutation}\n\nI know you have a busy schedule leading ${company}, so I'll keep this very brief. I wanted to connect regarding a potential strategic opportunity that aligns closely with your company's mission.\n\nWould you be open to a brief conversation, or is there a member of your leadership team you'd recommend I speak with?\n\nBest regards,\n[Your Name]`;
    }
};

window.copyDraftBody = function() {
    const bodyInput = document.getElementById('draft-body');
    if (bodyInput) {
        copyToClipboard(bodyInput.value, 'Email draft copied to clipboard!');
    }
};

window.openDraftInGmail = function() {
    const toInput = document.getElementById('draft-to-email')?.value || '';
    const subject = document.getElementById('draft-subject')?.value || '';
    const body = document.getElementById('draft-body')?.value || '';

    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toInput)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
};

window.openDraftInMailto = function() {
    const toInput = document.getElementById('draft-to-email')?.value || '';
    const subject = document.getElementById('draft-subject')?.value || '';
    const body = document.getElementById('draft-body')?.value || '';

    const url = `mailto:${toInput}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
};

window.closeColdEmailModal = function() {
    document.getElementById('cold-email-modal')?.classList.add('hidden');
};

// ==========================================
// BATCH PROCESSING ("we have many company soyoure doing this")
// ==========================================
function initFileUpload() {
    const dropzone = document.getElementById('csv-dropzone');
    const fileInput = document.getElementById('csv-file-input');
    const textarea = document.getElementById('batch-textarea');

    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        if (!e.target.files.length) return;
        const file = e.target.files[0];
        await handleCsvUpload(file);
    });

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('border-indigo-500', 'bg-indigo-950/20');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('border-indigo-500', 'bg-indigo-950/20');
    });

    dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-indigo-500', 'bg-indigo-950/20');
        if (e.dataTransfer.files.length) {
            await handleCsvUpload(e.dataTransfer.files[0]);
        }
    });
}

async function handleCsvUpload(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/api/upload-csv', {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error('File upload parsing failed');
        const data = await res.json();
        
        const textarea = document.getElementById('batch-textarea');
        if (textarea) {
            textarea.value = data.companies.join('\n');
        }
        showToast(`Loaded ${data.count} companies from ${data.filename}!`);
    } catch (err) {
        showToast('Error uploading CSV file', 'error');
    }
}

window.startBatchSearch = async function() {
    const textarea = document.getElementById('batch-textarea');
    const rawText = textarea?.value.trim() || '';
    if (!rawText) {
        showToast('Please enter or upload company names.', 'error');
        return;
    }

    const companies = rawText.split('\n').map(c => c.trim()).filter(Boolean);
    if (!companies.length) {
        showToast('No valid company names found.', 'error');
        return;
    }

    state.batchCompanies = companies;
    state.batchResults = [];
    state.batchProgress = { current: 0, total: companies.length, active: true };

    const startBtn = document.getElementById('start-batch-btn');
    const progressContainer = document.getElementById('batch-progress-container');
    const progressBar = document.getElementById('batch-progress-bar');
    const progressText = document.getElementById('batch-progress-text');
    const resultsContainer = document.getElementById('batch-results-container');

    if (startBtn) startBtn.disabled = true;
    progressContainer?.classList.remove('hidden');
    resultsContainer?.classList.add('hidden');

    try {
        const payload = {
            companies: companies,
            hunter_api_key: state.settings.hunterApiKey || null,
            verify_smtp: state.settings.verifySmtp
        };

        progressText.textContent = `Processing ${companies.length} companies... (this queries live MX & role mailboxes)`;
        progressBar.style.width = '40%';

        const res = await fetch('/api/batch-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Batch processing failed');

        const data = await res.json();
        state.batchResults = data.companies || [];
        progressBar.style.width = '100%';
        progressText.textContent = `Completed! ${state.batchResults.length} companies processed.`;

        setTimeout(() => {
            progressContainer?.classList.add('hidden');
            resultsContainer?.classList.remove('hidden');
            renderBatchResults();
        }, 600);

        showToast(`Batch processing finished! Found leads across ${state.batchResults.length} companies.`);
    } catch (err) {
        console.error('Batch search error:', err);
        showToast(err.message || 'Batch search failed.', 'error');
    } finally {
        if (startBtn) startBtn.disabled = false;
        state.batchProgress.active = false;
    }
};

function renderBatchResults() {
    const tableBody = document.getElementById('batch-leads-tbody');
    const totalCompaniesEl = document.getElementById('batch-stat-companies');
    const totalLeadsEl = document.getElementById('batch-stat-leads');
    const totalValidEl = document.getElementById('batch-stat-valid');
    const totalHrEl = document.getElementById('batch-stat-hr');

    let allFlatLeads = [];
    state.batchResults.forEach(comp => {
        (comp.contacts || []).forEach(lead => {
            allFlatLeads.push({
                company: comp.company,
                domain: comp.domain,
                ...lead
            });
        });
    });

    if (totalCompaniesEl) totalCompaniesEl.textContent = state.batchResults.length;
    if (totalLeadsEl) totalLeadsEl.textContent = allFlatLeads.length;
    if (totalValidEl) totalValidEl.textContent = allFlatLeads.filter(l => l.verification.status === 'valid' || l.verification.status === 'role_based').length;
    if (totalHrEl) totalHrEl.textContent = allFlatLeads.filter(l => l.category === 'HR').length;

    if (!tableBody) return;

    tableBody.innerHTML = allFlatLeads.map(lead => {
        const v = lead.verification;
        let badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        if (v.status === 'risky') badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        if (v.status === 'invalid') badgeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';

        return `
            <tr class="border-b border-slate-800/80 hover:bg-slate-800/40 transition">
                <td class="p-3.5">
                    <div class="font-semibold text-slate-100 text-sm">${lead.company}</div>
                    <div class="text-xs text-slate-400 font-mono">${lead.domain}</div>
                </td>
                <td class="p-3.5">
                    <div class="font-medium text-slate-200 text-sm">${lead.name}</div>
                    <div class="text-xs text-indigo-400">${lead.title}</div>
                </td>
                <td class="p-3.5">
                    <span class="px-2 py-0.5 text-xs font-semibold rounded border ${lead.category === 'HR' ? 'bg-indigo-950 text-indigo-300 border-indigo-700' : lead.category === 'VP' ? 'bg-purple-950 text-purple-300 border-purple-700' : 'bg-teal-950 text-teal-300 border-teal-700'}">
                        ${lead.category}
                    </span>
                </td>
                <td class="p-3.5">
                    <div class="flex items-center gap-2 font-mono text-xs text-slate-300">
                        <span>${lead.email}</span>
                        <button onclick="copyToClipboard('${lead.email}')" class="text-slate-500 hover:text-slate-200" title="Copy">
                            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </td>
                <td class="p-3.5">
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold border ${badgeColor}">
                        ${v.status.toUpperCase()} (${v.score}%)
                    </span>
                </td>
                <td class="p-3.5 text-right">
                    <button onclick="openBatchLeadDraft('${lead.email}')" class="px-3 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-medium rounded-lg transition">
                        Cold Mail
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    featherInit();
}

window.openBatchLeadDraft = function(email) {
    let targetLead = null;
    let targetComp = null;
    for (const comp of state.batchResults) {
        for (const contact of comp.contacts) {
            if (contact.email === email) {
                targetLead = contact;
                targetComp = comp;
                break;
            }
        }
        if (targetLead) break;
    }

    if (!targetLead) return;
    state.currentResults = targetComp;
    openColdEmailModal(email);
};

window.exportBatchLeads = async function(format) {
    let allFlatLeads = [];
    state.batchResults.forEach(comp => {
        (comp.contacts || []).forEach(lead => {
            allFlatLeads.push({
                company: comp.company,
                domain: comp.domain,
                ...lead
            });
        });
    });

    if (!allFlatLeads.length) {
        showToast('No leads available to export.', 'error');
        return;
    }

    try {
        const payload = {
            format: format,
            company_name: 'Batch_Leads',
            leads: allFlatLeads
        };

        const res = await fetch('/api/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Batch export failed');

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mailscout_batch_leads.${format === 'excel' ? 'xlsx' : 'csv'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showToast(`Exported ${allFlatLeads.length} leads to ${format.toUpperCase()}!`);
    } catch (err) {
        showToast('Export failed', 'error');
    }
};

// ==========================================
// STANDALONE EMAIL VERIFIER ("check their mail address it a ligit or not")
// ==========================================
window.verifyStandaloneEmail = async function() {
    const input = document.getElementById('verifier-input');
    const email = input?.value.trim();
    if (!email || !email.includes('@')) {
        showToast('Please enter a valid email address.', 'error');
        return;
    }

    const btn = document.getElementById('verify-standalone-btn');
    const resultBox = document.getElementById('verifier-result-box');
    const loader = document.getElementById('verifier-loader');

    if (btn) btn.disabled = true;
    loader?.classList.remove('hidden');

    try {
        const res = await fetch('/api/verify-single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, check_smtp: state.settings.verifySmtp })
        });

        if (!res.ok) throw new Error('Verification failed');
        const data = await res.json();
        state.verifierResult = data;

        renderStandaloneVerifierResult(data);
        resultBox?.classList.remove('hidden');
        showToast(`Verification completed for ${email}!`);
    } catch (err) {
        showToast('Error during verification.', 'error');
    } finally {
        if (btn) btn.disabled = false;
        loader?.classList.add('hidden');
        featherInit();
    }
};

function renderStandaloneVerifierResult(v) {
    const emailEl = document.getElementById('verifier-res-email');
    const statusBadge = document.getElementById('verifier-res-status');
    const scoreEl = document.getElementById('verifier-res-score');
    const recEl = document.getElementById('verifier-res-recommendation');
    const mxHostEl = document.getElementById('verifier-res-mx');
    const syntaxBadge = document.getElementById('verifier-res-syntax');
    const dispBadge = document.getElementById('verifier-res-disposable');
    const catchallBadge = document.getElementById('verifier-res-catchall');
    const smtpDetailsEl = document.getElementById('verifier-res-smtp-notes');

    if (emailEl) emailEl.textContent = v.email;
    if (scoreEl) scoreEl.textContent = `${v.score}%`;
    if (recEl) recEl.textContent = v.recommendation;
    if (mxHostEl) mxHostEl.textContent = v.mx_host || 'None';

    if (statusBadge) {
        statusBadge.textContent = v.status.toUpperCase();
        if (v.status === 'valid' || v.status === 'role_based') {
            statusBadge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
        } else if (v.status === 'risky') {
            statusBadge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40';
        } else {
            statusBadge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40';
        }
    }

    if (syntaxBadge) {
        syntaxBadge.innerHTML = v.is_valid_format ? 
            '<span class="text-emerald-400 flex items-center gap-1"><i data-lucide="check" class="w-3.5 h-3.5"></i> RFC Valid</span>' :
            '<span class="text-rose-400 flex items-center gap-1"><i data-lucide="x" class="w-3.5 h-3.5"></i> Invalid</span>';
    }

    if (dispBadge) {
        dispBadge.innerHTML = !v.is_disposable ? 
            '<span class="text-emerald-400 flex items-center gap-1"><i data-lucide="shield-check" class="w-3.5 h-3.5"></i> Clean</span>' :
            '<span class="text-rose-400 flex items-center gap-1"><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> Disposable</span>';
    }

    if (catchallBadge) {
        catchallBadge.innerHTML = v.is_catch_all ? 
            '<span class="text-amber-400 flex items-center gap-1"><i data-lucide="alert-circle" class="w-3.5 h-3.5"></i> Catch-All (Accepts Any)</span>' :
            '<span class="text-emerald-400 flex items-center gap-1"><i data-lucide="check" class="w-3.5 h-3.5"></i> Dedicated Box</span>';
    }

    if (smtpDetailsEl) {
        smtpDetailsEl.textContent = v.smtp_details || (v.smtp_verified ? '250 Mailbox Verified Deliverable' : 'Checked against MX Records');
    }
}

// ==========================================
// SETTINGS MODAL
// ==========================================
function initSettings() {
    const hunterInput = document.getElementById('settings-hunter-key');
    const smtpToggle = document.getElementById('settings-smtp-toggle');

    if (hunterInput) hunterInput.value = state.settings.hunterApiKey;
    if (smtpToggle) smtpToggle.checked = state.settings.verifySmtp;
}

window.openSettingsModal = function() {
    document.getElementById('settings-modal')?.classList.remove('hidden');
    featherInit();
};

window.closeSettingsModal = function() {
    document.getElementById('settings-modal')?.classList.add('hidden');
};

window.saveSettings = function() {
    const hunterInput = document.getElementById('settings-hunter-key');
    const smtpToggle = document.getElementById('settings-smtp-toggle');

    if (hunterInput) {
        state.settings.hunterApiKey = hunterInput.value.trim();
        localStorage.setItem('mailscout_hunter_key', state.settings.hunterApiKey);
    }
    if (smtpToggle) {
        state.settings.verifySmtp = smtpToggle.checked;
        localStorage.setItem('mailscout_verify_smtp', state.settings.verifySmtp ? 'true' : 'false');
    }

    closeSettingsModal();
    showToast('Settings saved successfully!');
};

