const page = document.body.dataset.page;

const ADMIN_EMAIL = "admin@splitwise.com";
const ADMIN_PASSWORD = "admin123";


function getData(key, defaultValue = []) {
    return JSON.parse(localStorage.getItem(key)) || defaultValue;
}


function saveData(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}


function getCurrentUser() {
    return JSON.parse(
        localStorage.getItem("splitwiseCurrentUser")
    );
}


function go(page) {
    window.location.href = "/" + page;
}


function logout() {
    localStorage.removeItem("splitwiseCurrentUser");
    go("index.html");
}


function formatMoney(amount) {
    return "₹" + Number(amount).toFixed(2);
}


function getUsers() {
    return getData("splitwiseUsers");
}


function getGroups() {
    return getData("splitwiseGroups");
}


function getExpenses() {
    return getData("splitwiseExpenses");
}


function currentUserGroups() {

    const user = getCurrentUser();

    if (!user) {
        return [];
    }

    return getGroups().filter(function(group) {
        return group.members.includes(user.email);
    });
}


function getUserName(email) {

    const users = getUsers();

    const user = users.find(function(user) {
        return user.email === email;
    });

    if (user) {
        return user.name;
    }

    if (email === ADMIN_EMAIL) {
        return "Admin";
    }

    return email;
}


/* =========================
   LOGIN
========================= */

if (page === "login") {

    const loginForm = document.getElementById("loginForm");

    loginForm.addEventListener("submit", function(event) {

        event.preventDefault();

        const email =
            document.getElementById("loginEmail").value.trim();

        const password =
            document.getElementById("loginPassword").value;

        if (
            email === ADMIN_EMAIL &&
            password === ADMIN_PASSWORD
        ) {

            const admin = {
                name: "Administrator",
                email: ADMIN_EMAIL,
                role: "admin"
            };

            saveData("splitwiseCurrentUser", admin);

            go("admin.html");

            return;
        }

        const users = getUsers();

        const user = users.find(function(user) {
            return (
                user.email === email &&
                user.password === password
            );
        });

        if (!user) {

            document.getElementById("loginMessage").textContent =
                "Invalid email or password.";

            return;
        }

        saveData("splitwiseCurrentUser", user);

        go("dashboard.html");
    });
}


/* =========================
   SIGNUP
========================= */

if (page === "signup") {

    const signupForm = document.getElementById("signupForm");

    signupForm.addEventListener("submit", function(event) {

        event.preventDefault();

        const name =
            document.getElementById("signupName").value.trim();

        const email =
            document.getElementById("signupEmail").value.trim();

        const password =
            document.getElementById("signupPassword").value;

        let users = getUsers();

        const exists = users.some(function(user) {
            return user.email === email;
        });

        if (exists) {

            document.getElementById("signupMessage").textContent =
                "Email is already registered.";

            return;
        }

        const newUser = {
            id: Date.now(),
            name: name,
            email: email,
            password: password,
            role: "user"
        };

        users.push(newUser);

        saveData("splitwiseUsers", users);

        alert("Account created successfully!");

        go("index.html");
    });
}


/* =========================
   COMMON NAVIGATION
========================= */

document.querySelectorAll("[data-go]").forEach(function(button) {

    button.addEventListener("click", function() {

        go(button.dataset.go);

    });

});


const logoutButton =
    document.getElementById("logoutBtn");

if (logoutButton) {

    logoutButton.addEventListener("click", logout);

}


/* =========================
   LOGIN PROTECTION
========================= */

if (
    page === "dashboard" ||
    page === "groups" ||
    page === "expenses"
) {

    const user = getCurrentUser();

    if (!user || user.role !== "user") {
        go("index.html");
    }
}


if (page === "admin") {

    const user = getCurrentUser();

    if (!user || user.role !== "admin") {
        go("index.html");
    }
}


/* =========================
   DASHBOARD
========================= */

function calculateDebts(groupId) {

    const groups = getGroups();

    const group = groups.find(function(group) {
        return group.id === groupId;
    });

    if (!group) {
        return [];
    }

    const members = group.members;

    let balances = {};

    members.forEach(function(member) {
        balances[member] = 0;
    });

    const expenses = getExpenses().filter(function(expense) {
        return expense.groupId === groupId;
    });

    expenses.forEach(function(expense) {

        const share =
            expense.amount / expense.participants.length;

        expense.participants.forEach(function(member) {

            balances[member] -= share;

        });

        balances[expense.paidBy] += expense.amount;
    });


    let debtors = [];
    let creditors = [];

    Object.entries(balances).forEach(function([email, balance]) {

        if (balance < -0.01) {

            debtors.push({
                email: email,
                amount: -balance
            });

        }

        if (balance > 0.01) {

            creditors.push({
                email: email,
                amount: balance
            });

        }

    });


    let debts = [];

    let i = 0;
    let j = 0;

    while (
        i < debtors.length &&
        j < creditors.length
    ) {

        const amount = Math.min(
            debtors[i].amount,
            creditors[j].amount
        );

        debts.push({
            groupId: groupId,
            from: debtors[i].email,
            to: creditors[j].email,
            amount: amount
        });

        debtors[i].amount -= amount;
        creditors[j].amount -= amount;

        if (debtors[i].amount < 0.01) {
            i++;
        }

        if (creditors[j].amount < 0.01) {
            j++;
        }

    }

    return debts;
}


function getAllDebts() {

    let debts = [];

    getGroups().forEach(function(group) {

        debts = debts.concat(
            calculateDebts(group.id)
        );

    });

    return debts;
}


if (page === "dashboard") {

    const user = getCurrentUser();

    document.getElementById("welcome").textContent =
        "Welcome, " + user.name;


    const groups = currentUserGroups();

    const expenses = getExpenses().filter(function(expense) {

        return groups.some(function(group) {
            return group.id === expense.groupId;
        });

    });


    let youOwe = 0;
    let youGet = 0;

    const reminders =
        document.getElementById("reminders");

    reminders.innerHTML = "";


    getAllDebts().forEach(function(debt) {

        if (debt.from === user.email) {

            youOwe += debt.amount;

            const group =
                getGroups().find(
                    group => group.id === debt.groupId
                );

            reminders.innerHTML += `
                <div class="item">
                    You owe
                    <b>${getUserName(debt.to)}</b>
                    ${formatMoney(debt.amount)}
                    in <b>${group.name}</b>
                </div>
            `;
        }


        if (debt.to === user.email) {

            youGet += debt.amount;

            const group =
                getGroups().find(
                    group => group.id === debt.groupId
                );

            reminders.innerHTML += `
                <div class="item">
                    <b>${getUserName(debt.from)}</b>
                    owes you
                    ${formatMoney(debt.amount)}
                    in <b>${group.name}</b>
                </div>
            `;
        }

    });


    if (reminders.innerHTML === "") {

        reminders.innerHTML =
            '<p class="success">No pending payments.</p>';

    }


    document.getElementById("groupCount").textContent =
        groups.length;

    document.getElementById("expenseCount").textContent =
        expenses.length;

    document.getElementById("oweAmount").textContent =
        formatMoney(youOwe);

    document.getElementById("getAmount").textContent =
        formatMoney(youGet);


    const recent =
        document.getElementById("recentExpenses");

    if (expenses.length === 0) {

        recent.innerHTML =
            "<p>No expenses yet.</p>";

    } else {

        recent.innerHTML = "";

        expenses.slice(-5).reverse().forEach(function(expense) {

            recent.innerHTML += `
                <div class="item">
                    <b>${expense.name}</b>
                    - ${formatMoney(expense.amount)}
                    <br>
                    Paid by ${getUserName(expense.paidBy)}
                </div>
            `;

        });

    }

}


/* =========================
   GROUPS
========================= */

function renderGroups() {

    const userGroups = currentUserGroups();

    const list =
        document.getElementById("groupList");

    const memberGroup =
        document.getElementById("memberGroup");


    if (!list || !memberGroup) {
        return;
    }


    list.innerHTML = "";
    memberGroup.innerHTML = "";


    if (userGroups.length === 0) {

        list.innerHTML =
            "<p>No groups created yet.</p>";

        memberGroup.innerHTML =
            '<option value="">Create a group first</option>';

        return;

    }


    userGroups.forEach(function(group) {

        const option =
            document.createElement("option");

        option.value = group.id;
        option.textContent = group.name;

        memberGroup.appendChild(option);


        list.innerHTML += `
            <div class="item">

                <b>${group.name}</b>

                <p>
                    Members: ${group.members.length}
                </p>

                <button
                    class="open-group"
                    data-id="${group.id}">
                    Open Expenses
                </button>

            </div>
        `;

    });


    document.querySelectorAll(".open-group")
        .forEach(function(button) {

            button.addEventListener(
                "click",
                function() {

                    localStorage.setItem(
                        "selectedGroup",
                        button.dataset.id
                    );

                    go("expense.html");

                }
            );

        });

}


if (page === "groups") {

    renderGroups();


    document.getElementById("groupForm")
        .addEventListener("submit", function(event) {

            event.preventDefault();

            const name =
                document.getElementById("groupName")
                    .value.trim();

            if (name === "") {
                return;
            }

            let groups = getGroups();

            const user = getCurrentUser();

            groups.push({
                id: Date.now(),
                name: name,
                createdBy: user.email,
                members: [user.email]
            });

            saveData("splitwiseGroups", groups);

            document.getElementById("groupName").value = "";

            renderGroups();

        });


    document.getElementById("addMemberBtn")
        .addEventListener("click", function() {

            const groupId =
                Number(
                    document.getElementById("memberGroup").value
                );

            const email =
                document.getElementById("memberEmail")
                    .value.trim();

            const users = getUsers();

            const userExists =
                users.some(function(user) {
                    return user.email === email;
                });


            if (!userExists) {

                document.getElementById("memberMessage").textContent =
                    "That user must sign up first.";

                return;
            }


            let groups = getGroups();

            const group =
                groups.find(
                    group => group.id === groupId
                );


            if (group.members.includes(email)) {

                document.getElementById("memberMessage").textContent =
                    "User is already in this group.";

                return;
            }


            group.members.push(email);

            saveData("splitwiseGroups", groups);

            document.getElementById("memberEmail").value = "";

            document.getElementById("memberMessage").textContent =
                "Member added successfully.";

            renderGroups();

        });

}


/* =========================
   EXPENSE PAGE
========================= */

function loadExpenseGroups() {

    const select =
        document.getElementById("expenseGroup");

    if (!select) {
        return;
    }

    select.innerHTML = "";

    const groups = currentUserGroups();

    groups.forEach(function(group) {

        select.innerHTML += `
            <option value="${group.id}">
                ${group.name}
            </option>
        `;

    });


    const selected =
        localStorage.getItem("selectedGroup");

    if (
        selected &&
        groups.some(group => group.id === Number(selected))
    ) {

        select.value = selected;

    }

    renderExpenseForm();
}


function renderExpenseForm() {

    const select =
        document.getElementById("expenseGroup");

    if (!select || !select.value) {
        return;
    }

    const groupId = Number(select.value);

    localStorage.setItem(
        "selectedGroup",
        groupId
    );


    const group =
        getGroups().find(
            group => group.id === groupId
        );


    const paidBy =
        document.getElementById("paidBy");

    const participants =
        document.getElementById("participants");


    paidBy.innerHTML = "";
    participants.innerHTML = "";


    group.members.forEach(function(email) {

        paidBy.innerHTML += `
            <option value="${email}">
                ${getUserName(email)}
            </option>
        `;


        participants.innerHTML += `
            <label class="checkbox">
                <input
                    type="checkbox"
                    name="participant"
                    value="${email}"
                    checked
                >
                ${getUserName(email)}
            </label>
        `;

    });


    renderExpenseHistory();
    renderBalances();

}


function renderExpenseHistory() {

    const list =
        document.getElementById("expenseList");

    if (!list) {
        return;
    }

    const groupId =
        Number(
            document.getElementById("expenseGroup").value
        );


    const expenses =
        getExpenses().filter(
            expense => expense.groupId === groupId
        );


    list.innerHTML = "";


    if (expenses.length === 0) {

        list.innerHTML =
            "<p>No expenses yet.</p>";

        return;

    }


    expenses.slice().reverse().forEach(function(expense) {

        list.innerHTML += `
            <div class="item">

                <b>${expense.name}</b>

                <p>
                    Amount:
                    ${formatMoney(expense.amount)}
                </p>

                <p>
                    Paid by:
                    ${getUserName(expense.paidBy)}
                </p>

                <p>
                    ${formatMoney(
                        expense.amount /
                        expense.participants.length
                    )}
                    per person
                </p>

            </div>
        `;

    });

}


function renderBalances() {

    const list =
        document.getElementById("balanceList");

    if (!list) {
        return;
    }

    const groupId =
        Number(
            document.getElementById("expenseGroup").value
        );


    const debts =
        calculateDebts(groupId);

    list.innerHTML = "";


    if (debts.length === 0) {

        list.innerHTML =
            '<p class="success">Everyone is settled.</p>';

        return;

    }


    debts.forEach(function(debt) {

        list.innerHTML += `
            <div class="item">

                <b>${getUserName(debt.from)}</b>
                owes
                <b>${getUserName(debt.to)}</b>

                ${formatMoney(debt.amount)}

            </div>
        `;

    });

}


if (page === "expenses") {

    loadExpenseGroups();


    document.getElementById("expenseGroup")
        .addEventListener(
            "change",
            renderExpenseForm
        );


    document.getElementById("addExpenseBtn")
        .addEventListener("click", function() {

            const groupId =
                Number(
                    document.getElementById("expenseGroup").value
                );


            const name =
                document.getElementById("expenseName")
                    .value.trim();


            const amount =
                Number(
                    document.getElementById("expenseAmount").value
                );


            const paidBy =
                document.getElementById("paidBy").value;


            const participants =
                Array.from(
                    document.querySelectorAll(
                        'input[name="participant"]:checked'
                    )
                ).map(
                    input => input.value
                );


            if (
                !name ||
                amount <= 0 ||
                !paidBy ||
                participants.length === 0
            ) {

                alert("Fill all expense details.");

                return;
            }


            let expenses = getExpenses();

            expenses.push({
                id: Date.now(),
                groupId: groupId,
                name: name,
                amount: amount,
                paidBy: paidBy,
                participants: participants,
                createdAt: new Date().toLocaleDateString()
            });


            saveData(
                "splitwiseExpenses",
                expenses
            );


            document.getElementById("expenseName").value = "";
            document.getElementById("expenseAmount").value = "";

            renderExpenseHistory();
            renderBalances();

            alert("Expense added successfully.");

        });

}


/* =========================
   ADMIN
========================= */

if (page === "admin") {

    const users = getUsers();
    const groups = getGroups();
    const expenses = getExpenses();


    document.getElementById("adminUsers").textContent =
        users.length;

    document.getElementById("adminGroups").textContent =
        groups.length;

    document.getElementById("adminExpenses").textContent =
        expenses.length;


    const userList =
        document.getElementById("userList");


    if (users.length === 0) {

        userList.innerHTML =
            "<p>No registered users.</p>";

    } else {

        users.forEach(function(user) {

            userList.innerHTML += `
                <div class="item">

                    <b>${user.name}</b>
                    <br>
                    ${user.email}

                </div>
            `;

        });

    }


    const groupList =
        document.getElementById("adminGroupList");


    if (groups.length === 0) {

        groupList.innerHTML =
            "<p>No groups created.</p>";

    } else {

        groups.forEach(function(group) {

            groupList.innerHTML += `
                <div class="item">

                    <b>${group.name}</b>

                    <p>
                        Members:
                        ${group.members.length}
                    </p>

                </div>
            `;

        });

    }


    const expenseList =
        document.getElementById("adminExpenseList");


    if (expenses.length === 0) {

        expenseList.innerHTML =
            "<p>No expenses recorded.</p>";

    } else {

        expenses.slice().reverse().forEach(function(expense) {

            const group =
                groups.find(
                    group => group.id === expense.groupId
                );


            expenseList.innerHTML += `
                <div class="item">

                    <b>${expense.name}</b>

                    <p>
                        Group:
                        ${group ? group.name : "Unknown"}
                    </p>

                    <p>
                        Amount:
                        ${formatMoney(expense.amount)}
                    </p>

                    <p>
                        Paid by:
                        ${getUserName(expense.paidBy)}
                    </p>

                </div>
            `;

        });

    }

}