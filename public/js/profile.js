function showTab(tabName) {
    const tabs = document.getElementsByClassName('content-tab');
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].style.display = 'none';
    }
    document.getElementById(tabName + '-tab').style.display = 'block';
}
