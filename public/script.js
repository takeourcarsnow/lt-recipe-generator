// State management
const state = {
    selectedIngredients: new Set(),
    currentCategory: 'darzoves',
    searchTimeout: null
};

// Theme handling
const themeManager = {
    set(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        const icon = document.querySelector('#themeToggle i');
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    },

    toggle() {
        const currentTheme = localStorage.getItem('theme') || 'light';
        this.set(currentTheme === 'light' ? 'dark' : 'light');
    },

    init() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.set(savedTheme);
        document.getElementById('themeToggle').addEventListener('click', () => this.toggle());
    }
};

// UI Components
const UI = {
    elements: {
        ingredientsList: document.getElementById('ingredientsList'),
        selectedList: document.getElementById('selectedIngredientsList'),
        pricesList: document.getElementById('pricesList'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        recipeSection: document.getElementById('recipeSection'),
        searchInput: document.querySelector('.search-bar input')
    },

    createIngredientItem(ingredient, isSelected) {
        const div = document.createElement('div');
        div.className = `ingredient-item ${isSelected ? 'selected' : ''}`;
        div.textContent = ingredient;
        div.addEventListener('click', () => this.toggleIngredient(ingredient, div));
        return div;
    },

    displayIngredients(ingredients) {
        this.elements.ingredientsList.innerHTML = '';
        ingredients.forEach((ingredient, index) => {
            const div = this.createIngredientItem(
                ingredient,
                state.selectedIngredients.has(ingredient)
            );
            div.style.animationDelay = `${index * 50}ms`;
            this.elements.ingredientsList.appendChild(div);
        });
    },

    toggleIngredient(ingredient, element) {
        if (state.selectedIngredients.has(ingredient)) {
            state.selectedIngredients.delete(ingredient);
            element.classList.remove('selected');
            this.removePriceItem(ingredient);
        } else {
            state.selectedIngredients.add(ingredient);
            element.classList.add('selected');
            this.fetchPrices(ingredient);
        }
        this.updateSelectedIngredientsList();
    },

    updateSelectedIngredientsList() {
        this.elements.selectedList.innerHTML = '';
        state.selectedIngredients.forEach(ingredient => {
            const div = document.createElement('div');
            div.className = 'selected-ingredient';
            div.innerHTML = `
                ${ingredient}
                <span class="remove-ingredient" onclick="UI.removeIngredient('${ingredient}')">✕</span>
            `;
            this.elements.selectedList.appendChild(div);
        });
    },

    removeIngredient(ingredient) {
        state.selectedIngredients.delete(ingredient);
        this.updateSelectedIngredientsList();
        this.removePriceItem(ingredient);

        const ingredientElements = document.querySelectorAll('.ingredient-item');
        ingredientElements.forEach(el => {
            if (el.textContent === ingredient) {
                el.classList.remove('selected');
            }
        });
    },

    async fetchPrices(ingredient) {
        try {
            const response = await fetch(`/api/prices/${encodeURIComponent(ingredient)}`);
            if (!response.ok) throw new Error('Failed to fetch prices');
            const prices = await response.json();
            this.displayPrices(ingredient, prices);
        } catch (error) {
            console.error('Error fetching prices:', error);
            this.displayPrices(ingredient, []);
        }
    },

    displayPrices(ingredient, prices) {
        const ingredientWithoutEmoji = ingredient.replace(/^[^\s]+\s/, '');
        let container = document.getElementById(`price-${ingredientWithoutEmoji}`);

        if (!container) {
            container = document.createElement('div');
            container.id = `price-${ingredientWithoutEmoji}`;
            container.className = 'price-item card';
            container.style.opacity = '0';
            container.style.transform = 'translateX(20px)';
            this.elements.pricesList.appendChild(container);

            setTimeout(() => {
                container.style.opacity = '1';
                container.style.transform = 'translateX(0)';
            }, 50);
        }

        container.innerHTML = prices.length ? `
            <h4>${ingredient}</h4>
            ${prices.map(price => `
                <div class="store-price">
                    <span class="store-name">${price.store}</span>
                    <a href="${price.url}" target="_blank" class="product-name">${price.name}</a>
                    <span class="price-value">${price.price}</span>
                </div>
            `).join('')}
        ` : `
            <h4>${ingredient}</h4>
            <p>Kainų nerasta</p>
        `;
    },

    removePriceItem(ingredient) {
        const ingredientWithoutEmoji = ingredient.replace(/^[^\s]+\s/, '');
        const priceItem = document.getElementById(`price-${ingredientWithoutEmoji}`);
        if (priceItem) {
            priceItem.style.opacity = '0';
            priceItem.style.transform = 'translateX(20px)';
            setTimeout(() => priceItem.remove(), 300);
        }
    },

    showError(message) {
        const toast = document.createElement('div');
        toast.className = 'error-toast';
        toast.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    displayRecipe(recipe) {
        this.elements.recipeSection.style.opacity = '0';
        this.elements.recipeSection.style.display = 'block';

        document.getElementById('recipeName').textContent = recipe.receptoPavadinimas;
        document.getElementById('prepTime').innerHTML = `<i class="far fa-clock"></i> ${recipe.gaminimoLaikas}`;
        document.getElementById('difficulty').innerHTML = `<i class="fas fa-chart-line"></i> ${recipe.sudetingumas}`;

        document.getElementById('recipeIngredients').innerHTML = recipe.ingredientai
            .map(ingredient => `<li><i class="fas fa-check"></i> ${ingredient}</li>`)
            .join('');

        document.getElementById('recipeInstructions').innerHTML = recipe.instrukcijos
            .map(instruction => `<li>${instruction}</li>`)
            .join('');

        document.getElementById('recipeTips').innerHTML = recipe.patarimai
            .map(tip => `<li><i class="fas fa-lightbulb"></i> ${tip}</li>`)
            .join('');

        setTimeout(() => {
            this.elements.recipeSection.style.opacity = '1';
            this.elements.recipeSection.scrollIntoView({ behavior: 'smooth' });
        }, 50);
    }
};

// Event Handlers
async function handleGenerateRecipe() {
    if (state.selectedIngredients.size === 0) {
        UI.showError('Prašome pasirinkti bent vieną ingredientą');
        return;
    }

    UI.elements.loadingOverlay.style.display = 'flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
        const response = await fetch('/api/generate-recipe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ingredients: Array.from(state.selectedIngredients)
            })
        });

        const data = await response.json();

        if (data.error) throw new Error(data.error);
        if (data.rawText) {
            console.error('Raw text received:', data.rawText);
            throw new Error('Nepavyko apdoroti recepto. Bandykite dar kartą.');
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        UI.displayRecipe(data);
    } catch (error) {
        console.error('Error generating recipe:', error);
        UI.showError('Nepavyko sugeneruoti recepto. Bandykite dar kartą.');
    } finally {
        UI.elements.loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            UI.elements.loadingOverlay.style.display = 'none';
            UI.elements.loadingOverlay.style.opacity = '1';
        }, 300);
    }
}

// Social Sharing
function shareOnFacebook() {
    const recipe = document.getElementById('recipeName').textContent;
    const url = encodeURIComponent(window.location.href);
    window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${url}"e=Pažiūrėk šį receptą: ${recipe}`,
        '_blank',
        'width=600,height=400'
    );
}

function shareOnTwitter() {
    const recipe = document.getElementById('recipeName').textContent;
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Pažiūrėk šį receptą: ${recipe}`);
    window.open(
        `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
        '_blank',
        'width=600,height=400'
    );
}

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    themeManager.init();

    try {
        const response = await fetch('/api/ingredients');
        const ingredients = await response.json();

        UI.displayIngredients(ingredients[state.currentCategory]);

        // Setup category buttons
        document.querySelectorAll('.category-btn').forEach(button => {
            button.addEventListener('click', () => {
                document.querySelectorAll('.category-btn').forEach(btn =>
                    btn.classList.remove('active')
                );
                button.classList.add('active');
                state.currentCategory = button.dataset.category;
                UI.displayIngredients(ingredients[state.currentCategory]);
            });
        });

        // Setup search
        UI.elements.searchInput.addEventListener('input', (e) => {
            clearTimeout(state.searchTimeout);
            state.searchTimeout = setTimeout(() => {
                const searchTerm = e.target.value.toLowerCase();
                if (!searchTerm) {
                    UI.displayIngredients(ingredients[state.currentCategory]);
                    return;
                }

                const filtered = Object.values(ingredients)
                    .flat()
                    .filter(ingredient =>
                        ingredient.toLowerCase().includes(searchTerm)
                    );
                UI.displayIngredients(filtered);
            }, 300);
        });

        // Setup generate button
        document.getElementById('generateRecipe')
            .addEventListener('click', handleGenerateRecipe);

    } catch (error) {
        console.error('Error initializing app:', error);
        UI.showError('Nepavyko užkrauti ingredientų');
    }
});
