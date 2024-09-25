
//Adiciona camadas pesquisáveis ao selection
selectOptions()
//Variáveis globais para armazenar resultados:  
var layersQuerrys = new Array() //a consulta realizada em listqueryable 
var resultWFS = new Array() // o resultado da pesquisa em wfs
var requestParams = new Object() // recolhe os parametros chave para requisição
var focus_style = L.geoJSON().addTo(map);// zoom e adicionar estilos
var layerSelectedIndex = 0

//Gera os os campos pesquisáveis 
function searchableFields() {
    $('#options_container').on('change', 'input[type="checkbox"]', function() {
        var $parentDiv = $(this).closest('.form-check');
        var layer = $(this).val();
        var $subOptions = $parentDiv.find('.sub-options');

        if ($(this).is(':checked')) {
            if ($subOptions.length === 0) {
                // Se não existir o contêiner de sub-opções, crie-o dinamicamente
                var subOptionsDiv = document.createElement('div');
                subOptionsDiv.className = 'sub-options';
                subOptionsDiv.style.display = 'none';

                // Adicione sub-opções dinamicamente aqui
                var option = layersQuerrys.find(item => item.layer === layer);
                if (option) {
                    Object.keys(option.queryFields).forEach((element) => {
                        console.log()
                        const subCheckbox = document.createElement('input');
                        subCheckbox.type = 'checkbox';
                        subCheckbox.value = element;
                        subCheckbox.id = `subfield_${element}`;
                        subCheckbox.className = 'form-check-input subSearch';

                        const subLabel = document.createElement('label');
                        subLabel.htmlFor = `subfield_${element}`;
                        subLabel.innerText = option.queryFields[element].fieldAlias ? option.queryFields[element].fieldAlias : element;
                        subLabel.className = 'form-check-label';

                        const subDiv = document.createElement('div');
                        subDiv.className = 'form-check';
                        subDiv.appendChild(subCheckbox);
                        subDiv.appendChild(subLabel);

                        subOptionsDiv.appendChild(subDiv);
                    });
                }

                $parentDiv.append(subOptionsDiv);
                $(subOptionsDiv).slideDown();
            } else {
                $subOptions.slideDown();
            }
        } else {
            // Desmarca todas as sub-opções e as oculta
            $subOptions.find('input[type="checkbox"]').prop('checked', false);
            $subOptions.slideUp();
        }
        updateSearchFieldsVisibility();
    });
}

//Gera a lista de camadas disponíveis para a pesquisa
function selectOptions() {
    $.ajax({
        url: '/listqueryable/',
        beforeSend: function () {
            $('#load').addClass('spinner-border ms-auto');
        },
        complete: function () {
            $('#load').removeClass('spinner-border ms-auto');
        },
        success: function (response) {
            const container = document.getElementById('options_container');
            container.innerHTML = ''; // Limpa as opções anteriores
            response.forEach(({ layer, layerName }) => {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = layer;
                checkbox.id = `option_${layer}`;
                checkbox.className = 'form-check-input group-layer';
                checkbox.addEventListener('change', searchableFields);
                checkbox.name = ''
                
                const label = document.createElement('label');
                label.htmlFor = `option_${layer}`;
                label.innerText = layerName;
                label.className = 'form-check-label';
                
                const div = document.createElement('div');
                div.className = 'form-check';
                div.appendChild(checkbox);
                div.appendChild(label);
                
                container.appendChild(div);
            });
            layersQuerrys = response;
        }
    });
}

//Controla Visibilidade do botão 'OK' conforme item marcado
function updateSearchFieldsVisibility() {
    const searchButtonContainer = document.getElementById('search_button_container');
    const checkboxes = document.querySelectorAll('#options_container input[type="checkbox"]');
    let hasVisibleSubOptions = false;

    checkboxes.forEach((checkbox) => {
        if (checkbox.checked) {
            const subOptions = checkbox.closest('.form-check').querySelector('.sub-options');
            if (subOptions && subOptions.children.length > 0) {
                hasVisibleSubOptions = true;
            }
        }
    });

    if (hasVisibleSubOptions) {
        searchButtonContainer.classList.add('show');
    } else {
        searchButtonContainer.classList.remove('show');
    }
}

//Concatena strings dos inputs para o cql_filter 
function filter_concate() {
    var cql_filter = ''
    fieldsChecked = []
    const checkboxes = document.querySelectorAll('.form-check-input.subSearch');
    checkboxes.forEach((checkbox) => {
        if (checkbox.checked) {
            fieldsChecked.push(checkbox.defaultValue)
        }
    });

    for (query in requestParams.layerSelect.queryFields) {
        if(fieldsChecked.includes(query)){
            var value = document.getElementById("sch").value
            if (!value.trim() == false) {
                //Adição da condição E para mais de uma propriedade
                cql_filter += (value != "" & cql_filter != "") ? " or " : ""
                //Verficação de tipo do campo
                if (requestParams.layerSelect.queryFields[query].fieldType == "string") {
                    // cql_filter+= ("("+query+" LIKE "+ "'%"+value+"%')")
                    cql_filter += ("(" + query + " LIKE " + "'%" + value + "%' or " + query + " LIKE " + "'%" + (value.toLowerCase()) + "%' or " + query + " LIKE " + "'%" + (value.toUpperCase()) + "%') ")
                } else {
                    cql_filter += (value != "") ? (isNaN(value)) ? (query + " = 000") : (query + " = " + "" + value + " ") : "";
                }
            }
        }
    }
    requestParams.filter_all = cql_filter

}

// Evento para manter o botão "OK" visível após o clique
$('#okSearch').on('click', function(event) {
    event.preventDefault(); // Previne o comportamento padrão
    // Chama a função de pesquisa, se necessário
    table_factory();
});

//Adicionar elementos a tabela 
function table_factory() {
    index = 0
    $("#buttons_table").show()
    if (download_enabled != 0)
        $("#download_all").show()

    const checkboxes = document.querySelectorAll('.form-check-input.group-layer');
    checkboxes.forEach((checkbox, index) => {
        if (checkbox.checked) {
            layerSelectedIndex = index
            var option = layersQuerrys[index];
            requestParams.layerSelect = option
            addLayerByName(requestParams.layerSelect.layer)
            filter_concate()
            //Adquire campos habilitados para o usuário
            $.get('/propertyname/' + option.layer, function (data) {

                requestParams.property_name = Object.keys(data.field)
                requestParams.property_name.push("id", "geom") // Adiciona o id e a geometria para utilizar em downloads e zoom
                var column = new Array()
                //Coluna para os botões
                column.push({
                    formatter: TableActions,
                    title: (download_enabled == 0) ? "Zoom" : "Download/Zoom"
                })
                //Forma a coluna json
                Object.keys(data.field).map((element) => {
                    if (element != 'geom') {
                        column.push({
                            field: element,
                            title: element
                        })

                    }
                })
                //Adicionando colunas a tabela
                $("#table").bootstrapTable({
                    columns: column
                })
                //Adicionando parametros a tabela  
                $("#table").bootstrapTable('refreshOptions', {
                    ajax: 'ajaxRequest',
                    pagination: true
                })

            })
        }
    });

}
//Requisição da tabela
function ajaxRequest(params) {
    var option = layersQuerrys[layerSelectedIndex];
    var wfsParams = {
        layer: option.layer,
        format: encodeURIComponent('application/json'),
        property_name: new Array(requestParams.property_name),
        cql_filter: (!requestParams.filter_all) ? "none" : encodeURIComponent(requestParams.filter_all),
        srs_name: 'EPSG:4326'

    }
    var url1 = '/wfs/' + Object.values(wfsParams).join('/')
    $.get({
        url: url1,
        success: (data) => {
            data = JSON.parse(data)

            if (!data.features) {
                //Condição para json com erro
                alert('Requested URL not found.')
            } else if (data.features.length == 0) {
                //Condição para resultados vazios  
                params.success([])
            } else {

                resultWFS = data
                zoomFeature(-1)
                properties = data.features.map(e => e.properties);
                params.success(properties)

            }

        },
        error: function (x, e) {
            params.success([])
            alert('Error:.\n' + x.responseText);
        }
    })


}


//Botbões da tabela
function TableActions(value, row, index, field) {
    if (download_enabled == 0) {
        return ['<button class="btn btn-dark btn-custom2 btn-sm" id="zoomFeature" onclick="zoomFeature(' + index + ')"> <i class="fas fa-search"></i></button>']
    } else {
        return ['<button class="btn btn-dark btn-custom btn-sm"  onclick="downloadFeature(' + index + ')"> <i id="downloadFeature' + index + '" class="fas fa-download"></i></button>', ' ', '<button class="btn btn-dark btn-custom2 btn-sm" id="zoomFeature" onclick="zoomFeature(' + index + ')"> <i class="fas fa-search"></i></button>'].join('');

    }
}
//Realiza requisição para o Download 
function downloadFeature(index_format) {
    /*A função recebe um parâmetro que pode ser um índice ou um formato    
    Caso seja um formato será realizada uma requisição com todos os objetos de pesquisa
    Caso seja um índice será realizado uma requisição geojson com o id da feição  
    */
    var wfsParams = {
        layer: requestParams.layerSelect.layer,
        format: isNaN(index_format) ? encodeURIComponent(index_format) : encodeURIComponent('application/json'),
        property_name: requestParams.property_name,
        cql_filter: isNaN(index_format) ? encodeURIComponent(requestParams.filter_all) : encodeURIComponent("id=" + resultWFS.features[index_format].properties.id)
    }


    url = '/wfs/' + Object.values(wfsParams).join('/')
    $.get({
        url: url, // Requisicao WFS para obter os resultados da pesquisa em JSON
        beforeSend: function () {
            //Adicionando spinner aos botões ( alternando ícone de download com spinner)
            if (isNaN(index_format)) {
                $("#download_img").removeClass("fas fa-download")
                $("#download_img").addClass("spinner-border spinner-border-sm")

            } else {
                $("#downloadFeature" + index_format).removeClass("fas fa-download")
                $("#downloadFeature" + index_format).addClass("spinner-border spinner-border-sm")
            }
        },
        complete: function () {
            //Removendo Spinner dos botões ( alternando ícone de download com spinner)
            if (isNaN(index_format)) {
                $("#download_img").removeClass("spinner-border spinner-border-sm")
                $("#download_img").addClass("fas fa-download")
            } else {
                $("#downloadFeature" + index_format).removeClass("spinner-border spinner-border-sm")
                $("#downloadFeature" + index_format).addClass("fas fa-download")

            }
        },
        success: (data) => { // Callback para caso dê tudo certo
            $("#load").hide();
            var blob = new Blob([data]);
            let link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            //Alteração do nome do resultado
            link.download = (resultWFS.features[0].id.split('.'))[0]
            switch (wfsParams.format) {
                case 'csv':
                    link.download += ".csv"
                    break
                case 'kml':
                    link.download += ".kml"
                    break
                default:
                    link.download += ".geojson"
                    break
            }
            link.click();

        },
        error: function (x, e) {
            alert('Error:.\n' + x.responseText);
        }
    })

}
//Aplica estilo e foca no local selecionado 
function zoomFeature(index) {
    focus_style.clearLayers()
    //Verifica qual o tipo de opção: um feição apenas ou todas pesquisadas
    var layer_focus = (index == -1) ? resultWFS.features : resultWFS.features[index].geometry
    data = JSON.parse(JSON.stringify(layer_focus))
    focus_style.addData(data)
    map.fitBounds(focus_style.getBounds())

}
//Remove todas os alterações feitas com a tabela
function closeTable() {
    if ($.isEmptyObject(requestParams) == false) {
        removeLayerByName(requestParams.layerSelect.layer)
        $("#table").bootstrapTable('destroy')
        $("#buttons_table").hide()
        searchableFields()
    }
    focus_style.clearLayers()

}
//Adiciona layer pelo controle de camadas
function addLayerByName(nameString) {
    Lc._layers.find(x => x.layer.options.layers === nameString).layer.addTo(map)
    return null
}

//Remove layer pelo controle de camadas
function removeLayerByName(nameString) {
    Lc._layers.find(x => x.layer.options.layers === nameString).layer.remove()
    return null
}

