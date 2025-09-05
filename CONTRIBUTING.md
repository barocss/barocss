# Contributing to BaroCSS

Thank you for your interest in contributing to BaroCSS! This document provides guidelines and information for contributors.

## 🤝 How to Contribute

There are many ways to contribute to BaroCSS:

- **🐛 Report bugs** - Help us identify and fix issues
- **💡 Suggest features** - Propose new ideas and improvements
- **📝 Improve documentation** - Help make our docs clearer and more comprehensive
- **🔧 Fix bugs** - Submit pull requests to fix issues
- **✨ Add features** - Implement new functionality
- **🧪 Write tests** - Improve test coverage and quality
- **🌐 Localization** - Help translate documentation to other languages

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm
- Git

### Development Setup

1. **Fork the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/barocss.git
   cd barocss
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Start development**
   ```bash
   # Start documentation site
   pnpm dev
   
   # Or work on specific package
   cd packages/barocss
   pnpm build
   ```

4. **Run tests**
   ```bash
   # Run all tests
   pnpm test
   
   # Or run tests for specific package
   cd packages/barocss
   pnpm test
   ```

## 📋 Development Guidelines

### Code Style

- **TypeScript**: Use TypeScript for all new code
- **Formatting**: Use Prettier for consistent formatting
- **Linting**: Follow ESLint rules
- **Naming**: Use descriptive names, follow camelCase for variables/functions
- **Comments**: Add JSDoc comments for public APIs

### Testing

- **Coverage**: Aim for high test coverage (>90%)
- **Unit Tests**: Write tests for individual functions and components
- **Integration Tests**: Test how different parts work together
- **Test Files**: Place tests in the `tests/` directory with `.test.ts` extension

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(core): add new utility class parser
fix(runtime): resolve memory leak in style injection
docs(readme): update installation instructions
test(engine): add test coverage for AST optimization
```

## 🔧 Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Your Changes

- Write your code following the guidelines above
- Add tests for new functionality
- Update documentation if needed
- Ensure all tests pass

### 3. Test Your Changes

```bash
# Run all tests
pnpm test

# Run tests in watch mode (for specific package)
cd packages/barocss
pnpm test:watch

# Check build
pnpm build
```

### 4. Submit a Pull Request

1. **Push your branch** to your fork
2. **Create a PR** against the `develop` branch
3. **Fill out the PR template** completely
4. **Link any related issues** using keywords like "Closes #123"

## 📦 Version Management with Changesets

BaroCSS uses [Changesets](https://github.com/changesets/changesets) for version management and release automation. This ensures consistent versioning and automated changelog generation.

### What are Changesets?

Changesets are markdown files that describe changes to packages. They allow contributors to specify:
- What type of change was made (patch, minor, major)
- A description of the change
- Which packages are affected

### Creating Changesets

When you make changes that should be included in a release:

1. **Create a changeset file**:
   ```bash
   pnpm changeset
   ```

2. **Select the package** that has changes (currently only `barocss`)
3. **Choose the change type**:
   - `patch`: Bug fixes and minor changes (0.0.x)
   - `minor`: New features (0.x.0)
   - `major`: Breaking changes (x.0.0)
4. **Write a description** of your changes

**Example changeset file** (`.changeset/feature-name.md`):
```markdown
---
"barocss": minor
---

feat: add new gradient utility classes
- Add support for custom gradient angles
- Improve gradient stop handling
- Fix memory leak in runtime
```

### Changeset Workflow

1. **During Development**:
   - Create changesets for significant changes
   - Commit changesets with your code changes
   - Push to your feature branch

2. **After PR Merge**:
   - Changesets are automatically collected
   - GitHub Actions create version PRs when needed
   - Maintainers review and merge version PRs

3. **Release Process**:
   - Version PRs automatically update package.json
   - Generate CHANGELOG.md entries
   - Create GitHub releases

### Changeset Best Practices

- **Create changesets early**: Don't wait until the end of development
- **Be descriptive**: Write clear, user-focused descriptions
- **Group related changes**: Use one changeset for related features/fixes
- **Choose appropriate types**: Be conservative with major version bumps
- **Single package focus**: Currently all changes affect the main `barocss` package

### Changeset Commands

```bash
# Create a new changeset
pnpm changeset

# Add changesets to git
git add .changeset/

# View current changesets
pnpm changeset status

# Build packages (required before versioning)
pnpm build

# Version packages (maintainers only)
pnpm version-packages

# Publish packages (maintainers only)
pnpm release
```

### Release Automation

BaroCSS uses GitHub Actions to automate the release process:

1. **Changeset Bot**: Automatically detects changesets in PRs
2. **Version PRs**: Creates automated version PRs when changesets are merged
3. **Release Workflow**: Automatically publishes packages and creates GitHub releases

**Important Notes**:
- **Never manually create version PRs** - let the automation handle it
- **Changesets must be in the develop branch** before versioning
- **All tests must pass** before versioning
- **Maintainers review** all version PRs before merging
- **Single package structure**: Currently all changes affect the main `barocss` package

## 📝 Pull Request Guidelines

### PR Title Format

```
type(scope): brief description
```

### PR Description Template

```markdown
## Description
Brief description of what this PR accomplishes.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] I have tested this change locally
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] All tests pass

## Changeset
- [ ] I have created a changeset for this change
- [ ] I have selected the appropriate change type (patch/minor/major)
- [ ] I have provided a clear description of the changes

## Checklist
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
```

## 🐛 Bug Reports

When reporting bugs, please include:

- **Clear description** of the problem
- **Steps to reproduce** the issue
- **Expected behavior** vs actual behavior
- **Environment details** (OS, browser, Node.js version)
- **Code examples** if applicable
- **Screenshots** for UI issues

## 💡 Feature Requests

For feature requests:

- **Clear description** of the feature
- **Use case** and why it's needed
- **Proposed implementation** if you have ideas
- **Alternatives** you've considered

## 🏗️ Project Structure

```
barocss/
├── apps/
│   └── barocss-docs/          # Documentation site
├── packages/
│   └── barocss/               # Core BaroCSS framework
│       ├── src/
│       │   ├── core/          # Core parsing and generation logic
│       │   ├── presets/       # Utility presets and variants
│       │   ├── runtime/       # Browser and server runtime
│       │   ├── theme/         # Theme system and defaults
│       │   └── utils/         # Utility functions and helpers
│       ├── tests/             # Test files
│       └── dist/              # Build output
├── .changeset/                # Changeset files for versioning
└── docs/                      # Project documentation
```

## 🔍 Code Review Process

1. **Automated checks** must pass (tests, linting, build)
2. **Code review** by maintainers
3. **Address feedback** and make requested changes
4. **Maintainer approval** required for merge
5. **Squash merge** to keep history clean

## 📚 Documentation

- **API Documentation**: Keep JSDoc comments up to date
- **README**: Update when adding new features
- **Examples**: Provide clear usage examples
- **Changelog**: Automatically generated from changesets

## 🆘 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Discord**: For real-time chat (if available)

## 📄 License

By contributing to BaroCSS, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors will be recognized in:
- Project README
- Release notes
- GitHub contributors list

---

Thank you for contributing to BaroCSS! 🎨✨
