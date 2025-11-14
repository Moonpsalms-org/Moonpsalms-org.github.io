window.addEventListener("load", () => {
    let store = [];
    const $searchMask = document.getElementById("search-mask");
    const $searchDialog = document.querySelector("#local-search .search-dialog");

    window.openSearch = () => {
        utils.animateIn($searchMask, "to_show 0.5s");
        $searchDialog.style.display = "flex";
        setTimeout(() => {
            document.querySelector("#local-search .search-box-input").focus();
        }, 100);
        document.addEventListener("keydown", function f(event) {
            if (event.code === "Escape") {
                closeSearch();
                document.removeEventListener("keydown", f);
            }
        });
        fixSafariHeight();
        window.addEventListener("resize", fixSafariHeight);
    };

    const fixSafariHeight = () => {
        if (window.innerWidth < 768) {
            $searchDialog.style.setProperty("--search-height", window.innerHeight + "px");
        }
    };

    const closeSearch = () => {
        utils.animateOut($searchDialog, "search_close .5s");
        utils.animateOut($searchMask, "to_hide 0.5s");
        window.removeEventListener("resize", fixSafariHeight);
    };

    const addEventCtrlK = () => {
        document.addEventListener("keydown", function (event) {
            if (event.ctrlKey && event.key === "k") {
                event.preventDefault();
                openSearch();
            }
        });
    };

    addEventCtrlK();

    const searchFnOnce = () => {
        $searchMask.addEventListener("click", closeSearch);
        utils.addEventListenerPjax(document.querySelector("#local-search .search-close-button"), "click", closeSearch);
    };

    searchFnOnce();

    const searchClickFn = () => {
        utils.addEventListenerPjax(document.querySelector("#search-button > .search"), "click", openSearch);

        GLOBAL_CONFIG.right_menu && document.getElementById("menu-search").addEventListener("click", function () {
            rm.hideRightMenu();
            openSearch();
            let t = document.getElementsByClassName('search-box-input')[0];
            let evt = document.createEvent('HTMLEvents');
            evt.initEvent('input', true, true)
            t.value = selectTextNow
            t.dispatchEvent(evt)
        });
    };

    searchClickFn();

    // 从二级标题之前的内容中提取『』中的特殊内容和VNDB编号
    function extractSpecialContent(title, content) {
        let specialContentBlocks = [];
        // 用于去重的集合
        const uniqueVndbIds = new Set();

        // 只处理二级标题之前的内容
        const contentBeforeH2 = extractContentBeforeSecondaryHeadings(content);

        // 1. 提取『』中的内容
        const contentMatch = contentBeforeH2.match(/『([^』]+)』/g);
        if (contentMatch) {
            contentMatch.forEach(match => {
                let text = match.replace(/『|』/g, '');
                let processedText = processTextContent(text).trim();
                if (processedText) {
                    specialContentBlocks.push(processedText);
                }
            });
        }

        // 2. 提取VNDB链接中的编号：例如 (https://vndb.org/v58707)
        const vndbLinks = contentBeforeH2.match(/https:\/\/vndb\.org\/v(\d+)/g);
        if (vndbLinks) {
            vndbLinks.forEach(link => {
                // 提取VNDB编号
                const vndbMatch = link.match(/https:\/\/vndb\.org\/v(\d+)/);
                if (vndbMatch && !uniqueVndbIds.has('v' + vndbMatch[1])) {
                    specialContentBlocks.push('v' + vndbMatch[1]);
                    uniqueVndbIds.add('v' + vndbMatch[1]);
                }
            });
        }

        // 3. 提取PikPak链接中的VNDB编号：例如 [v828]（仅在VNDB链接未提取到相同编号时）
        const pikpakLinks = contentBeforeH2.match(/<a[^>]*href="https:\/\/mypikpak\.com\/s\/[^"]+"[^>]*>\[.*?\]\[v(\d+)\]<\/a>/g);
        if (pikpakLinks) {
            pikpakLinks.forEach(link => {
                // 提取VNDB编号
                const vndbMatch = link.match(/\[v(\d+)\]/);
                if (vndbMatch && !uniqueVndbIds.has('v' + vndbMatch[1])) {
                    specialContentBlocks.push('v' + vndbMatch[1]);
                    uniqueVndbIds.add('v' + vndbMatch[1]);
                }
            });
        }

        // 4. 直接匹配内容中的[v数字]格式（不依赖于链接，仅在前面未提取到相同编号时）
        const vndbRegex = /\[v(\d+)\]/g;
        let vndbMatch;
        while ((vndbMatch = vndbRegex.exec(contentBeforeH2)) !== null) {
            if (!uniqueVndbIds.has('v' + vndbMatch[1])) {
                specialContentBlocks.push('v' + vndbMatch[1]);
                uniqueVndbIds.add('v' + vndbMatch[1]);
            }
        }

        // 将所有块合并，用 | 分隔以便后续分离显示
        return specialContentBlocks.join(' | ');
    }

    // 提取二级标题之前的内容
    function extractContentBeforeSecondaryHeadings(content) {
        // 查找第一个 ## 开头的行
        const h2Index = content.search(/^##\s/m);
        if (h2Index !== -1) {
            return content.substring(0, h2Index);
        }
        return content;
    }

    // 处理文本内容，保留纯文字并提取VNDB编号
    function processTextContent(text) {
        let processedText = text;

        // 1. 从文本中提取VNDB编号 [v数字] 格式
        const vndbRegex = /\[v(\d+)\]/g;
        let vndbMatch;
        while ((vndbMatch = vndbRegex.exec(text)) !== null) {
            // 将找到的VNDB编号添加到处理后的文本中
            processedText += ' v' + vndbMatch[1] + ' ';
        }

        // 2. 移除基本的Markdown链接，只保留链接文字
        processedText = processedText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

        // 3. 清理多余的空格
        processedText = processedText.replace(/\s+/g, ' ').trim();

        return processedText;
    } function init() {
        fetch(GLOBAL_CONFIG.localsearch.path)
            .then(response => response.text())
            .then(data => {
                let parser = new DOMParser();
                let xmlDoc = parser.parseFromString(data, "text/xml");
                let entries = xmlDoc.getElementsByTagName("entry");

                for (let i = 0; i < entries.length; i++) {
                    let entry = entries[i];
                    let title = entry.getElementsByTagName("title")[0].textContent;
                    let link = entry.getElementsByTagName("url")[0].textContent;

                    // 提取内容用于搜索
                    let content = '';
                    let contentElement = entry.getElementsByTagName("content")[0];
                    if (contentElement) {
                        // 只获取二级标题之前的内容，并直接传递HTML内容
                        content = contentElement.textContent;
                    }

                    // 提取『』中的内容和VNDB编号
                    let specialContent = extractSpecialContent(title, content);

                    // 提取标签
                    let tags = [];
                    let tagsElement = entry.getElementsByTagName("tags")[0];
                    if (tagsElement) {
                        let tagElements = tagsElement.getElementsByTagName("tag");
                        for (let j = 0; j < tagElements.length; j++) {
                            tags.push(tagElements[j].textContent);
                        }
                    }

                    store.push({
                        'title': title,
                        'link': link,
                        'specialContent': specialContent,
                        'tags': tags
                    });
                }


            })
            .catch(err => console.error("搜索数据加载失败:", err));
    }

    let query = '';
    let currentPage = 0;
    const resultsPerPage = 10;
    let results = [];

    function initUI() {
        const $results = document.getElementById("search-results");
        const $search = document.getElementById("search-input");
        $search.addEventListener('input', function (e) {
            $results.innerHTML = '';
            query = this.value.trim();
            if (query !== '') {
                results = search(query);
                renderResults(results, currentPage);
                renderPagination(results.length);
            } else {
                clearSearchResults();
            }
        });
    }

    function clearSearchResults() {
        const $results = document.getElementById("search-results");
        const $pagination = document.getElementById("search-pagination");
        const $tips = document.getElementById("search-tips");

        $results.innerHTML = '';
        $pagination.innerHTML = '';
        $tips.innerHTML = '';
    }

    // 搜索标题、『』中的特殊内容和标签
    function search(query) {
        // VNDB编号格式：v+数字
        const isVndbQuery = /^v\d+$/i.test(query);
        // 标签搜索格式：#标签
        const isTagQuery = query.startsWith('#');

        if (isTagQuery) {
            // 移除#号并转为小写进行搜索
            const tagQuery = query.substring(1).toLowerCase();
            return store.filter(page => {
                return page.tags && page.tags.some(tag =>
                    tag.toLowerCase().includes(tagQuery)
                );
            });
        } else if (isVndbQuery) {
            // 对VNDB编号使用单词边界精确匹配
            const exactRegex = new RegExp('\\b' + query + '\\b', 'i');

            return store.filter(page => {
                // 匹配标题或特殊内容
                const titleMatch = exactRegex.test(page.title);
                let specialMatch = false;
                if (page.specialContent) {
                    specialMatch = exactRegex.test(page.specialContent);
                }

                return titleMatch || specialMatch;
            });
        } else {
            // 对普通搜索使用包含匹配
            return store.filter(page => {
                // 搜索标题
                const titleMatch = page.title.toLowerCase().includes(query.toLowerCase());

                // 搜索特殊内容（『』中的内容）
                let specialMatch = false;
                if (page.specialContent) {
                    specialMatch = page.specialContent.toLowerCase().includes(query.toLowerCase());
                }

                // 搜索标签
                let tagMatch = false;
                if (page.tags) {
                    tagMatch = page.tags.some(tag =>
                        tag.toLowerCase().includes(query.toLowerCase())
                    );
                }

                return titleMatch || specialMatch || tagMatch;
            });
        }
    }

    function renderResults(results, page) {
        const $search_results = document.getElementById("search-results");
        $search_results.innerHTML = '';
        const $tips = document.getElementById("search-tips");
        $tips.innerHTML = '';
        const start = page * resultsPerPage;
        const end = start + resultsPerPage;
        if (!results.length) {
            const $empty = document.createElement("span");
            $empty.className = "search-result-empty";
            $empty.textContent = GLOBAL_CONFIG.lang.search.empty.replace(/\$\{query}/, query);
            $search_results.appendChild($empty);
            return;
        }

        // 收集所有匹配的标签
        const matchingTags = new Set();
        const isTagQuery = query.startsWith('#');
        const queryLower = query.toLowerCase();
        const tagQueryLower = isTagQuery ? queryLower.substring(1) : queryLower;

        results.forEach(result => {
            if (result.tags) {
                result.tags.forEach(tag => {
                    if (isTagQuery) {
                        // 如果是标签查询，只添加匹配的标签
                        if (tag.toLowerCase().includes(tagQueryLower)) {
                            matchingTags.add(tag);
                        }
                    } else {
                        // 如果是普通查询，添加所有包含的标签
                        if (tag.toLowerCase().includes(queryLower)) {
                            matchingTags.add(tag);
                        }
                    }
                });
            }
        });

        // 显示匹配的标签在搜索结果顶部
        if (matchingTags.size > 0) {
            const $matchingTagsContainer = document.createElement("div");
            $matchingTagsContainer.className = "matching-tags-container";
            $matchingTagsContainer.style.marginBottom = "20px";
            $matchingTagsContainer.style.padding = "10px";
            $matchingTagsContainer.style.backgroundColor = "#f5f5f5";
            $matchingTagsContainer.style.borderRadius = "5px";

            // 移除"匹配的标签："文字

            const $tagList = document.createElement("div");
            $tagList.style.display = "flex";
            $tagList.style.flexWrap = "wrap";
            $tagList.style.gap = "8px";

            Array.from(matchingTags).forEach(tag => {
                const $tag = document.createElement("a");
                $tag.className = "tag-list";
                // 将空格转换为连字符而不是URL编码
                const tagForUrl = tag.replace(/\s+/g, '-');
                $tag.href = `/tags/${tagForUrl}/`;
                $tag.innerHTML = `<i class="fas fa-tag"></i> ${tag}`;
                $tag.style.padding = "3px 8px";
                $tag.style.backgroundColor = "#e0e0e0";
                $tag.style.borderRadius = "4px";
                $tag.style.color = "#333";
                $tag.style.textDecoration = "none";
                $tag.style.fontSize = "0.9em";
                $tag.addEventListener("click", closeSearch);
                $tagList.appendChild($tag);
            });

            $matchingTagsContainer.appendChild($tagList);
            $search_results.appendChild($matchingTagsContainer);
        }

        results.slice(start, end).forEach(function (result) {
            const $result = document.createElement("li");
            $result.className = "search-result-item";
            const $link = document.createElement("a");
            $link.className = "search-result-title";
            $link.href = result.link;
            $link.innerHTML = highlightSearchKeyword(result.title, query);
            $result.appendChild($link);

            let hasDisplayedContent = false;

            // 如果有特殊内容且匹配，只显示包含搜索关键词的『』块
            if (result.specialContent) {
                // 将内容按 | 分割成多个块
                const contentBlocks = result.specialContent.split(' | ');

                // 过滤出包含搜索关键词的块
                const matchingBlocks = contentBlocks.filter(block => {
                    if (/^v\d+$/i.test(query)) {
                        // VNDB编号使用精确匹配
                        const exactRegex = new RegExp('\\b' + query + '\\b', 'i');
                        return exactRegex.test(block);
                    } else {
                        return block.toLowerCase().includes(query.toLowerCase());
                    }
                });

                // 限制显示最多3个匹配的块
                const limitedBlocks = matchingBlocks.slice(0, 3);

                if (limitedBlocks.length > 0) {
                    limitedBlocks.forEach((block, index) => {
                        const $special = document.createElement("div");
                        $special.className = "search-result-special";
                        $special.style.fontSize = "0.9em";
                        $special.style.color = "#666";
                        $special.style.marginTop = index === 0 ? "4px" : "2px";

                        // 清理并高亮显示
                        const cleanContent = cleanSpecialContentForDisplay(block, query);
                        $special.innerHTML = "『" + cleanContent + "』";
                        $result.appendChild($special);
                    });
                    hasDisplayedContent = true;
                }
            }



            // 不再显示每个结果的标签
            $search_results.appendChild($result);
        });
        const count = document.createElement("span");
        count.className = "search-result-count";
        count.innerHTML = GLOBAL_CONFIG.lang.search.count.replace(/\$\{count}/, results.length);
        $tips.appendChild(count);
    }

    function highlightSearchKeyword(text, keyword) {
        // 转义特殊字符，避免正则表达式错误
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedKeyword.split(' ').join('|')})`, 'gi');
        return text.replace(regex, '<em>$1</em>');
    }

    // 清理特殊内容用于显示，移除Markdown链接但保留文字，添加高亮
    function cleanSpecialContentForDisplay(content, query) {
        // 移除Markdown链接，只保留链接文字
        let cleanContent = content.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

        // 移除所有HTML标签，只保留纯文本
        cleanContent = cleanContent.replace(/<[^>]*>/g, '');

        // 清理多余的空格
        cleanContent = cleanContent.replace(/\s+/g, ' ').trim();

        // 应用高亮，但要避免在已有HTML标签内应用
        return highlightSearchKeyword(cleanContent, query);
    }



    function renderPagination(totalResults) {
        const totalPages = Math.ceil(totalResults / resultsPerPage);
        const paginationContainer = document.getElementById("search-pagination");
        paginationContainer.innerHTML = '';
        const paginationList = document.createElement("ul");
        paginationList.className = "pagination-list";

        for (let i = 0; i < totalPages; i++) {
            const button = document.createElement("li");
            button.className = "pagination-item";
            button.textContent = i + 1;
            if (i === currentPage) {
                button.classList.add('select');
            }
            button.addEventListener('click', function () {
                currentPage = i;
                renderResults(results, i);
                document.querySelectorAll(".pagination-item").forEach(function (btn) {
                    btn.classList.remove('select');
                });
                button.classList.add('select');
            });
            paginationList.appendChild(button);
        }
        paginationContainer.appendChild(paginationList);
    }

    init();
    initUI();
    window.addEventListener('DOMContentLoaded', (event) => {
        initUI();
    });
    window.addEventListener('pjax:complete', () => {
        searchClickFn();
    });
});
