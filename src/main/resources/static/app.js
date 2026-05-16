const STORAGE_KEY = "shaadi-biodata-details";
const UI_STORAGE_KEY = "shaadi-biodata-ui";

const sectionTargets = {
    personal: {fields: "personalFields", preview: "personalPreview"},
    family: {fields: "familyFields", preview: "familyPreview"},
    contact: {fields: "contactFields", preview: "contactPreview"}
};

const baseFields = [
    ["personal", "fullName", "Full Name", "Rohit Mahesh Patil"],
    ["personal", "dob", "Date of Birth", "12/04/1994, 06:20 AM"],
    ["personal", "height", "Height", "5'11\""],
    ["personal", "birthPlace", "Place of Birth", "Kolhapur, Maharashtra"],
    ["personal", "religion", "Religion", "Hindu"],
    ["personal", "caste", "Caste / Community", "Maratha"],
    ["personal", "zodiac", "Zodiac Sign", "Cancer"],
    ["personal", "nakshatra", "Nakshatra", "Pushya"],
    ["personal", "manglik", "Manglik Status", "No"],
    ["personal", "gotra", "Gotra", "Kashyap"],
    ["personal", "gan", "Gan", "Manushya"],
    ["personal", "complexion", "Complexion", "Wheatish"],
    ["personal", "bloodGroup", "Blood Group", "O+"],
    ["personal", "education", "Education", "B.E. Civil Engineering"],
    ["personal", "occupation", "Occupation", "Site Engineer"],
    ["personal", "income", "Annual Income", ""],
    ["family", "fatherName", "Father's Name", "Mahesh Shivaji Patil"],
    ["family", "fatherOccupation", "Father's Occupation", "Agriculture"],
    ["family", "motherName", "Mother's Name", "Savitri Mahesh Patil"],
    ["family", "motherOccupation", "Mother's Occupation", "Homemaker"],
    ["family", "brothers", "Brothers", "1 elder brother (married)"],
    ["family", "sisters", "Sisters", "None"],
    ["family", "maternalUncle", "Maternal Uncle", "Sanjay Deshmukh, Sangli"],
    ["family", "relatives", "Relatives", "Patil, Deshmukh, Jadhav"],
    ["contact", "mobile", "Mobile Number", "+91 98765 43210"],
    ["contact", "email", "Email", ""],
    ["contact", "address", "Address", "Shahupuri, Kolhapur - 416001"]
];

const defaultState = {
    template: "red",
    photoEnabled: true,
    values: Object.fromEntries(baseFields.map(([, key, , value]) => [key, value])),
    enabled: Object.fromEntries(baseFields.map(([, key]) => [key, true])),
    order: {
        personal: baseFields.filter(([section]) => section === "personal").map(([, key]) => key),
        family: baseFields.filter(([section]) => section === "family").map(([, key]) => key),
        contact: baseFields.filter(([section]) => section === "contact").map(([, key]) => key)
    },
    customFields: []
};

const form = document.getElementById("biodataForm");
const sheet = document.getElementById("biodataSheet");
const photoInput = document.getElementById("photo");
const photoEnabled = document.getElementById("photoEnabled");
const photoPreview = document.getElementById("photoPreview");
const photoFrame = document.querySelector(".photo-frame");
let state = structuredClone(defaultState);

document.addEventListener("DOMContentLoaded", () => {
    state = normalizeState(readSavedData());
    renderFieldEditors();
    hydrateTemplate();
    hydrateCollapsibleSections();
    bindEvents();
    renderPreview();

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
});

function bindEvents() {
    form.addEventListener("input", handleFormChange);
    form.addEventListener("change", handleFormChange);
    photoInput.addEventListener("change", handlePhotoChange);
    document.getElementById("clearForm").addEventListener("click", clearForm);
    document.getElementById("downloadPdf").addEventListener("click", generatePdf);
    document.querySelectorAll("[data-add-section]").forEach((button) => {
        button.addEventListener("click", () => addCustomField(button.dataset.addSection));
    });
    document.querySelectorAll(".collapse-toggle").forEach((button) => {
        button.addEventListener("click", () => toggleSection(button.closest(".collapsible-section")));
    });
}

function normalizeState(saved) {
    const next = structuredClone(defaultState);
    if (!saved || !Object.keys(saved).length) {
        return next;
    }

    next.template = saved.template || next.template;
    next.photoEnabled = saved.photoEnabled !== false;
    next.values = {...next.values, ...(saved.values || legacyValues(saved))};
    next.enabled = {...next.enabled, ...(saved.enabled || {})};
    next.customFields = Array.isArray(saved.customFields) ? saved.customFields : [];
    next.order = mergeOrder(saved.order, next.customFields);

    if (saved.photoData) {
        next.photoData = saved.photoData;
        setPhoto(saved.photoData);
    }

    return next;
}

function mergeOrder(savedOrder, customFields) {
    const order = structuredClone(defaultState.order);
    customFields.forEach((field) => {
        if (!order[field.section].includes(field.key)) {
            order[field.section].push(field.key);
        }
    });

    if (!savedOrder) {
        return order;
    }

    Object.keys(sectionTargets).forEach((section) => {
        const knownKeys = getKnownKeys(section, customFields);
        const savedKeys = Array.isArray(savedOrder[section]) ? savedOrder[section] : [];
        order[section] = [
            ...savedKeys.filter((key) => knownKeys.includes(key)),
            ...knownKeys.filter((key) => !savedKeys.includes(key))
        ];
    });

    return order;
}

function getKnownKeys(section, customFields = state.customFields) {
    return [
        ...baseFields.filter(([fieldSection]) => fieldSection === section).map(([, key]) => key),
        ...customFields.filter((field) => field.section === section).map((field) => field.key)
    ];
}

function legacyValues(saved) {
    const values = {};
    baseFields.forEach(([, key]) => {
        if (typeof saved[key] === "string") {
            values[key] = saved[key];
        }
    });
    return values;
}

function renderFieldEditors() {
    Object.values(sectionTargets).forEach(({fields}) => {
        document.getElementById(fields).innerHTML = "";
    });

    getAllFields().forEach((field) => {
        const row = document.createElement("div");
        row.className = "field-row";
        row.dataset.key = field.key;

        const enabled = document.createElement("label");
        enabled.className = "include-toggle";
        enabled.innerHTML = `
            <input type="checkbox" data-enabled-key="${field.key}" ${state.enabled[field.key] ? "checked" : ""}>
            <span>Show</span>
        `;

        const labelInput = document.createElement("input");
        labelInput.value = field.label;
        labelInput.dataset.labelKey = field.key;
        labelInput.placeholder = "Field label";
        labelInput.disabled = !field.custom;
        labelInput.setAttribute("aria-label", `${field.label} label`);

        const valueInput = field.key === "address" ? document.createElement("textarea") : document.createElement("input");
        valueInput.value = state.values[field.key] || "";
        valueInput.dataset.valueKey = field.key;
        valueInput.placeholder = field.placeholder || field.label;
        valueInput.setAttribute("aria-label", field.label);
        if (valueInput.tagName === "TEXTAREA") {
            valueInput.rows = 3;
        }

        row.append(enabled, labelInput, valueInput);

        if (field.custom) {
            const remove = document.createElement("button");
            remove.className = "remove-field";
            remove.type = "button";
            remove.textContent = "Remove";
            remove.addEventListener("click", () => removeCustomField(field.key));
            row.append(remove);
        }

        const controls = document.createElement("div");
        controls.className = "field-actions";
        controls.innerHTML = `
            <button type="button" data-move-key="${field.key}" data-direction="up">Up</button>
            <button type="button" data-move-key="${field.key}" data-direction="down">Down</button>
            <button type="button" data-add-below="${field.key}">Add Below</button>
        `;
        controls.querySelectorAll("[data-move-key]").forEach((button) => {
            button.addEventListener("click", () => moveField(button.dataset.moveKey, button.dataset.direction));
        });
        controls.querySelector("[data-add-below]").addEventListener("click", () => addCustomField(field.section, field.key));
        row.append(controls);

        document.getElementById(sectionTargets[field.section].fields).appendChild(row);
    });
}

function getAllFields() {
    const fields = [
        ...baseFields.map(([section, key, label, placeholder]) => ({
        section,
        key,
        label,
        placeholder,
        custom: false
        })),
        ...state.customFields
    ];

    return Object.keys(sectionTargets).flatMap((section) => {
        const byKey = new Map(fields.filter((field) => field.section === section).map((field) => [field.key, field]));
        return state.order[section].map((key) => byKey.get(key)).filter(Boolean);
    });
}

function hydrateTemplate() {
    const selected = Array.from(form.elements.template).find((item) => item.value === state.template);
    if (selected) {
        selected.checked = true;
    }
    photoEnabled.checked = state.photoEnabled;
}

function hydrateCollapsibleSections() {
    const uiState = readUiState();
    document.querySelectorAll(".collapsible-section").forEach((section) => {
        const collapsed = Boolean(uiState.collapsed?.[section.dataset.sectionId]);
        setSectionCollapsed(section, collapsed);
    });
}

function toggleSection(section) {
    const collapsed = !section.classList.contains("is-collapsed");
    setSectionCollapsed(section, collapsed);
    const uiState = readUiState();
    uiState.collapsed = {...(uiState.collapsed || {}), [section.dataset.sectionId]: collapsed};
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(uiState));
}

function setSectionCollapsed(section, collapsed) {
    const button = section.querySelector(".collapse-toggle");
    section.classList.toggle("is-collapsed", collapsed);
    if (button) {
        button.setAttribute("aria-expanded", String(!collapsed));
        button.querySelector("span").textContent = collapsed ? "Open" : "Close";
    }
}

function readUiState() {
    try {
        return JSON.parse(localStorage.getItem(UI_STORAGE_KEY) || "{}");
    } catch {
        return {};
    }
}

function handleFormChange(event) {
    const target = event.target;

    if (target.name === "template") {
        state.template = form.elements.template.value;
    }

    if (target.id === "photoEnabled") {
        state.photoEnabled = target.checked;
    }

    if (target.dataset.enabledKey) {
        state.enabled[target.dataset.enabledKey] = target.checked;
    }

    if (target.dataset.valueKey) {
        state.values[target.dataset.valueKey] = target.value.trim();
    }

    if (target.dataset.labelKey) {
        updateCustomLabel(target.dataset.labelKey, target.value.trim());
    }

    saveData();
    renderPreview();
}

function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
        state.photoData = reader.result;
        setPhoto(reader.result);
        saveData();
    });
    reader.readAsDataURL(file);
}

function addCustomField(section, afterKey = null) {
    const key = `custom_${Date.now()}`;
    const field = {
        section,
        key,
        label: "New Field",
        placeholder: "Enter value",
        custom: true
    };
    state.customFields.push(field);
    state.values[key] = "";
    state.enabled[key] = true;
    const order = state.order[section];
    const insertAt = afterKey && order.includes(afterKey) ? order.indexOf(afterKey) + 1 : order.length;
    order.splice(insertAt, 0, key);
    renderFieldEditors();
    saveData();
    renderPreview();
}

function removeCustomField(key) {
    state.customFields = state.customFields.filter((field) => field.key !== key);
    delete state.values[key];
    delete state.enabled[key];
    Object.keys(state.order).forEach((section) => {
        state.order[section] = state.order[section].filter((item) => item !== key);
    });
    renderFieldEditors();
    saveData();
    renderPreview();
}

function moveField(key, direction) {
    const field = getAllFields().find((item) => item.key === key);
    if (!field) {
        return;
    }

    const order = state.order[field.section];
    const index = order.indexOf(key);
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) {
        return;
    }

    [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
    renderFieldEditors();
    saveData();
    renderPreview();
}

function updateCustomLabel(key, label) {
    const field = state.customFields.find((item) => item.key === key);
    if (field) {
        field.label = label || "New Field";
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function readSavedData() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
        return {};
    }
}

function renderPreview() {
    sheet.className = `biodata-sheet theme-${state.template || "red"}`;
    sheet.classList.toggle("without-photo", !state.photoEnabled);
    document.getElementById("previewName").textContent = state.values.fullName || "Marriage Biodata";

    Object.entries(sectionTargets).forEach(([section, {preview}]) => {
        const target = document.getElementById(preview);
        target.innerHTML = "";

        getAllFields()
            .filter((field) => field.section === section && state.enabled[field.key])
            .forEach((field) => {
                const value = state.values[field.key];
                if (!value && field.key === "email") {
                    return;
                }

                const dt = document.createElement("dt");
                const dd = document.createElement("dd");
                dt.textContent = field.label;
                dd.textContent = value || "-";
                target.append(dt, dd);
            });
    });
}

function setPhoto(src) {
    photoPreview.src = src;
    photoFrame.classList.add("has-photo");
}

function clearForm() {
    state = structuredClone(defaultState);
    photoPreview.removeAttribute("src");
    photoFrame.classList.remove("has-photo");
    localStorage.removeItem(STORAGE_KEY);
    renderFieldEditors();
    hydrateTemplate();
    hydrateCollapsibleSections();
    renderPreview();
}

function generatePdf() {
    saveData();
    renderPreview();
    document.body.classList.add("printing");
    window.scrollTo(0, 0);
    requestAnimationFrame(() => window.print());
}

window.addEventListener("afterprint", () => {
    document.body.classList.remove("printing");
});
